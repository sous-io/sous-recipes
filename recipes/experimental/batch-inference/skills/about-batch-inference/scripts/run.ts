// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Runs one experiment spec and writes everything it did into its own run directory:
// <output dir>/<spec name>/<run id>/. Parallel runs (even of the same spec) never share a file
// except the content-addressed response cache and the append-only shared cost log.
//
// Usage: node run.ts [--dry-run] [--items <file>] [--answer-key <file>] [--prompts-dir <dir>]
//                    [--cache-dir <dir>] [--output-dir <dir>] <spec.json>
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { cacheFile, cacheKey, type CallOptions, type CostSink } from "./lib/cache.ts";
import { loadAnswerKey, loadItems, readPromptJson, renderTemplate, selectItems, type KeyEntry, type Selected } from "./lib/data.ts";
import { appendLines, uniqueStamp, writeAtomic, writeJson } from "./lib/files.ts";
import { formatCost, itemTable, LEGEND, repeatsSummary, repeatsTable, scoreRows, scoresTable, verdictFor, type ResultRow } from "./lib/report.ts";
import { resolveSpec, type ModelPlan, type PathOverrides, type Spec } from "./lib/spec.ts";
import { buildRequest, callMessages, type MessagesRequest, type ProviderResult } from "./providers/anthropic.ts";
import { askJev, type JevRequest } from "./providers/jev.ts";
import type { Answer } from "./tasks/types.ts";

// ---- Arguments --------------------------------------------------------------------------------
const USAGE = "usage: node run.ts [--dry-run] [--items <file>] [--answer-key <file>] [--prompts-dir <dir>] [--cache-dir <dir>] [--output-dir <dir>] <spec.json>";
const FLAGS: Record<string, keyof PathOverrides> = { "--items": "items", "--answer-key": "answerKey", "--prompts-dir": "promptsDir", "--cache-dir": "cacheDir", "--output-dir": "outputDir" };
const overrides: PathOverrides = {};
let dryRun = false;
let specPath: string | null = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a in FLAGS) { if (!argv[i + 1]) { console.error(`${a} needs a value\n${USAGE}`); process.exit(2); } overrides[FLAGS[a]] = argv[++i]; }
    else if (a.startsWith("--") || specPath) { console.error(USAGE); process.exit(2); }
    else specPath = a;
}
if (!specPath) { console.error(USAGE); process.exit(2); }

const specText = readFileSync(specPath, "utf8");
const spec: Spec = JSON.parse(specText);
const { task, plans, paths, concurrency, repeats, cache } = resolveSpec(spec, dirname(resolve(specPath)), overrides);

// ---- Answer key and items ---------------------------------------------------------------------
const key: Map<string, KeyEntry> | null = paths.answer_key ? loadAnswerKey(paths.answer_key) : null;
const selected = selectItems(loadItems(paths.items), spec.items, key);

// ---- Run directory ----------------------------------------------------------------------------
const specDir = join(paths.output_dir, spec.name);
mkdirSync(specDir, { recursive: true });
let runId = "", runDir = "";
for (let i = 0; ; i++) {
    runId = uniqueStamp();
    runDir = join(specDir, runId);
    // mkdir without `recursive` fails when the directory exists, so two runs never share one.
    try { mkdirSync(runDir); break; } catch (e: any) { if (e.code !== "EEXIST" || i > 5) throw e; }
}
const costs: CostSink = { runCostFile: join(runDir, "cost.jsonl"), sharedCostFile: join(paths.output_dir, "cost-log.jsonl") };
const startedAt = new Date();
writeAtomic(join(runDir, "spec.json"), specText);
writeAtomic(costs.runCostFile!, ""); // one line per paid call of this run
writeJson(join(runDir, "resolved.json"), {
    spec_path: resolve(specPath),
    spec_sha256: createHash("sha256").update(specText).digest("hex"),
    task: task.name,
    paths,
    plans,
    concurrency,
    repeats,
    cache,
    dry_run: dryRun,
    items: selected.map((s) => ({ id: s.item.id, group: s.group })),
});
const environment = { node: process.version, platform: process.platform, arch: process.arch, hostname: hostname(), pid: process.pid, cwd: process.cwd(), argv: process.argv };
const runInfo: Record<string, unknown> = { spec_name: spec.name, run_id: runId, run_dir: runDir, status: dryRun ? "dry-run" : "running", started_at: startedAt.toISOString(), environment };
writeJson(join(runDir, "run.json"), runInfo);
console.log(`run ${spec.name}/${runId}${dryRun ? " (dry run: no API calls)" : ""}`);

// ---- Requests ---------------------------------------------------------------------------------
// With repeats, every request goes out once per repeat, unchanged; each repeat is scored under its
// own label, "<label>.r<k>".
interface Job { index: number; plan: ModelPlan; repeat: number; label: string; items: Selected[]; request: MessagesRequest | JevRequest; cacheKey: string; cacheDir: string; job: string }
const jobs: Job[] = [];
const repeatLabel = (plan: ModelPlan, r: number) => (repeats > 1 ? `${plan.label}.r${r}` : plan.label);
const options = (plan: ModelPlan) => ({ withConfidence: plan.with_confidence });
const cacheDirFor = (plan: ModelPlan) => join(paths.cache_dir, plan.provider);
for (const plan of plans) {
    // Requests are identical across repeats, so they are built once per plan.
    const built: { items: Selected[]; request: MessagesRequest | JevRequest }[] = [];
    if (plan.provider === "anthropic") {
        const system = renderTemplate(plan.prompt_path, task.anthropic.flags(options(plan)));
        const schema = task.anthropic.schema(options(plan));
        // Batches never mix groups, so a group always goes out in the same requests.
        for (const group of [...new Set(selected.map((s) => s.group))]) {
            const items = selected.filter((s) => s.group === group);
            for (let i = 0; i < items.length; i += plan.batch_size) {
                const batch = items.slice(i, i + plan.batch_size);
                const user = task.anthropic.user(batch.map((b) => b.item), plan.context);
                built.push({ items: batch, request: buildRequest({ model: plan.model, maxTokens: plan.max_tokens, system, user, schema }) });
            }
        }
    } else {
        const ps = readPromptJson(plan.prompt_path);
        for (const s of selected) built.push({ items: [s], request: { model: plan.jev_model!, state: task.jev.state(ps.state, s.item, plan.context), questions: ps.questions } });
    }
    for (let repeat = 1; repeat <= repeats; repeat++) {
        const label = repeatLabel(plan, repeat);
        for (const b of built) jobs.push({ index: jobs.length, plan, repeat, label, items: b.items, request: b.request, cacheKey: cacheKey(b.request), cacheDir: cacheDirFor(plan), job: `eval:${spec.name}:${runId}:${label}` });
    }
}
appendLines(join(runDir, "requests.jsonl"), jobs.map((j) => ({ index: j.index, label: j.label, ...(repeats > 1 ? { repeat: j.repeat } : {}), model: j.plan.model, item_ids: j.items.map((i) => i.item.id), cache_key: j.cacheKey, request: j.request })));

if (dryRun) {
    const perLabel = new Map<string, { requests: number; cached: number }>();
    for (const j of jobs) {
        const t = perLabel.get(j.label) ?? { requests: 0, cached: 0 };
        t.requests++;
        if (cache === "use" && existsSync(cacheFile(j.cacheDir, j.cacheKey))) t.cached++;
        perLabel.set(j.label, t);
    }
    Object.assign(runInfo, { finished_at: new Date().toISOString(), totals: { requests: jobs.length }, per_model: Object.fromEntries(perLabel) });
    writeJson(join(runDir, "run.json"), runInfo);
    console.log(`${selected.length} items, ${jobs.length} requests:`);
    for (const [label, t] of perLabel) console.log(`  ${label}: ${t.requests} requests, ${t.cached} already in the cache`);
    console.log(`requests written to ${join(runDir, "requests.jsonl")}`);
    process.exit(0);
}

// ---- Execute ----------------------------------------------------------------------------------
interface Outcome { job: Job; res: ProviderResult | null; answers: Map<string, Answer> | null; error: string | null; ms: number }
const outcomes: Outcome[] = new Array(jobs.length);

async function runJob(j: Job): Promise<Outcome> {
    const t0 = Date.now();
    const o: CallOptions = { job: j.job, cacheDir: j.cacheDir, costs, cache };
    try {
        let res: ProviderResult, answers: Map<string, Answer>;
        const ids = j.items.map((i) => i.item.id);
        if (j.plan.provider === "anthropic") {
            res = await callMessages(j.request as MessagesRequest, (v) => task.anthropic.validate(v, ids, options(j.plan)), o);
            answers = task.anthropic.parse(res.data, options(j.plan));
        } else {
            const r = j.request as JevRequest;
            res = await askJev(r, o);
            answers = new Map([[ids[0], task.jev.parse(res.data as any, j.plan.decision_question!, r.questions)]]);
        }
        return { job: j, res, answers, error: null, ms: Date.now() - t0 };
    } catch (e: any) {
        return { job: j, res: null, answers: null, error: String(e?.message ?? e), ms: Date.now() - t0 };
    }
}

let next = 0;
async function worker(): Promise<void> {
    while (next < jobs.length) {
        const j = jobs[next++];
        const o = await runJob(j);
        outcomes[j.index] = o;
        appendLines(join(runDir, "responses.jsonl"), [{
            index: j.index, label: j.label, ...(repeats > 1 ? { repeat: j.repeat } : {}), model: j.plan.model, item_ids: j.items.map((i) => i.item.id),
            ms: o.ms, error: o.error, cached: o.res?.cached ?? null, cache_key: o.res?.cache_key ?? null, usage: o.res?.usage ?? null,
            cost_usd: o.res?.cost_usd ?? null, list_cost_usd: o.res?.list_cost_usd ?? null, raw: o.res?.raw ?? null, sent_request: o.res?.sent_request ?? null,
        }]);
        const tag = o.error ? `ERROR ${o.error}` : `${o.res!.cached ? "cached" : "paid"}, cost ${o.res!.cost_usd === null ? "unknown" : o.res!.cost_usd.toFixed(5) + " USD"}`;
        console.log(`  ${j.label} #${j.index} (${j.items.length} items): ${tag}`);
    }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

// ---- Results, scores, table -------------------------------------------------------------------
const allRows: ResultRow[] = [];
const totals: Record<string, any> = {};
const rowLabels: string[] = [];
for (const plan of plans) for (let repeat = 1; repeat <= repeats; repeat++) {
    const label = repeatLabel(plan, repeat);
    rowLabels.push(label);
    const mine = outcomes.filter((o) => o.job.plan === plan && o.job.repeat === repeat);
    const rows: ResultRow[] = [];
    for (const o of mine) for (const sel of o.job.items) {
        const it = sel.item;
        const a = o.answers?.get(it.id) ?? null;
        const k = key?.get(it.id) ?? null;
        const truth = k ? { ...task.truth(k), note: k.note ?? null } : null;
        const { verdict, correct } = verdictFor(a?.answer ?? null, a?.confidence ?? null, plan.threshold, truth);
        rows.push({
            run_id: runId, spec_name: spec.name, task: task.name, label, ...(repeats > 1 ? { base_label: plan.label, repeat } : {}), model: plan.model, provider: plan.provider, prompt: plan.prompt,
            context: plan.context, with_confidence: plan.with_confidence, threshold: plan.threshold,
            group: sel.group, item_id: it.id, item: it,
            answer: a?.answer ?? null, confidence: a?.confidence ?? null, ...(a?.detail ?? {}),
            verdict, correct, truth,
            request_index: o.job.index, request_items: o.job.items.length, cache_key: o.res?.cache_key ?? null, cached: o.res?.cached ?? null,
            usage: o.res?.usage ?? null, cost_usd: o.res?.cost_usd ?? null, list_cost_usd: o.res?.list_cost_usd ?? null, error: o.error ?? (a ? null : "no answer for this item"),
        });
    }
    writeAtomic(join(runDir, "results", `${label}.jsonl`), rows.map((r) => JSON.stringify(r) + "\n").join(""));
    allRows.push(...rows);
    const ok = mine.filter((o) => o.res);
    const sum = (f: (o: Outcome) => number | null | undefined) => ok.reduce((n, o) => n + (f(o) ?? 0), 0);
    totals[label] = {
        requests: mine.length, cached: ok.filter((o) => o.res!.cached).length, errors: mine.filter((o) => o.error).length,
        input_tokens: sum((o) => o.res!.usage?.input_tokens), output_tokens: sum((o) => o.res!.usage?.output_tokens),
        // Unknown when any paid call had no known price.
        cost_usd: ok.some((o) => !o.res!.cached && o.res!.cost_usd === null) ? null : sum((o) => o.res!.cost_usd),
        list_cost_usd: ok.some((o) => o.res!.list_cost_usd === null) ? null : sum((o) => o.res!.list_cost_usd),
        ms: sum((o) => o.ms),
    };
}

const scores = scoreRows(allRows);
const repeatStats = repeats > 1 ? repeatsSummary(plans.map((p) => ({ label: p.label, repeats: Array.from({ length: repeats }, (_, i) => allRows.filter((r) => r.label === repeatLabel(p, i + 1))) }))) : null;
writeJson(join(runDir, "scores.json"), { spec_name: spec.name, run_id: runId, task: task.name, scores, totals, ...(repeatStats ? { repeats: repeatStats } : {}) });
const scoreLines = rowLabels.filter((l) => scores[l]).flatMap((l) => [
    ...Object.entries(scores[l].groups).map(([g, t]) => ({ label: l, group: g, t })),
    { label: l, group: "all", t: scores[l].all, cost: totals[l].cost_usd, cached: `${totals[l].cached}/${totals[l].requests}` },
]);
const md = [
    `# ${spec.name} / ${runId}`,
    "",
    spec.notes ? `${spec.notes}\n` : "",
    `Task: ${task.name}. Threshold: ${[...new Set(plans.map((p) => p.threshold))].join(", ")}. Models: ${plans.map((p) => `${p.label} (${p.prompt}${p.provider === "anthropic" ? `, confidence ${p.with_confidence ? "on" : "off"}` : ""})`).join("; ")}.${repeats > 1 ? ` Repeats: ${repeats}.` : ""}${cache === "bypass" ? " Cache: bypassed." : ""}`,
    "",
    ...(repeatStats ? ["## Repeats", "", repeatsTable(repeatStats), ""] : []),
    "## Scores",
    "",
    scoresTable(scoreLines),
    "",
    "## Items",
    "",
    LEGEND,
    "",
    itemTable(rowLabels.map((l) => ({ header: l, rows: allRows.filter((r) => r.label === l) }))),
    "",
].join("\n");
writeAtomic(join(runDir, "table.md"), md);

const finishedAt = new Date();
const grand = Object.values(totals) as any[];
const errors = grand.reduce((n, t) => n + t.errors, 0);
const unknown = grand.some((t) => t.cost_usd === null);
Object.assign(runInfo, {
    status: errors ? "partial" : "complete",
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    totals: {
        requests: jobs.length, cached: grand.reduce((n, t) => n + t.cached, 0), errors,
        input_tokens: grand.reduce((n, t) => n + t.input_tokens, 0), output_tokens: grand.reduce((n, t) => n + t.output_tokens, 0),
        cost_usd: unknown ? null : grand.reduce((n, t) => n + t.cost_usd, 0),
        ...(unknown ? { cost_note: "some paid calls have an unknown price; see per-model totals" } : {}),
    },
    per_model: totals,
});
writeJson(join(runDir, "run.json"), runInfo);
console.log("\n" + scoresTable(scoreLines));
if (repeatStats) console.log("\n" + repeatsTable(repeatStats));
const t = runInfo.totals as any;
console.log(`\n${runId}: ${t.cached}/${jobs.length} cached, cost ${formatCost(t.cost_usd)} USD; results in ${runDir}`);
if (errors) process.exitCode = 1;
