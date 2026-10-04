// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Simulates fallback chains from recorded answers: each item goes to the first model of a chain;
// when that model's answer passes the step's acceptance rule the item is settled, otherwise it goes
// to the next model, and an item no step settles is left for a human. Pure replay of the results
// files of earlier runs; it makes no API calls.
//
// Usage: node simulate-chain.ts --chain <step>,<step>... [--chain ...] [--scale <n>] [--out <file.md>] <run dir>...
// --scale <n> adds a column with each chain's cost extrapolated to n items.
//
// A step is `<label>[:<rule>[@<threshold>]]`:
//   label      a model label of one of the runs, or `<run id>/<label>` when two runs share a label;
//              for a run with repeats, the base label (without `.r1`)
//   rule       any   (default) a confident answer either way is accepted
//              true  only a confident `true` is accepted
//              false only a confident `false` is accepted
//   threshold  confidence (0 to 1) an answer needs to count as confident; default: the threshold
//              the answer was recorded with. Written only after a rule (labels may hold "@").
// Example: --chain "jev:false,claude-sonnet-5-5:any@0.8"
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readJsonl, writeAtomic } from "./lib/files.ts";
import { cellText, type ResultRow } from "./lib/report.ts";

const USAGE = "usage: node simulate-chain.ts --chain <label>[:any|true|false[@<threshold>]],... [--chain ...] [--scale <n>] [--out <file.md>] <run dir>...";
type Rule = "any" | "true" | "false";
interface Step { spec: string; label: string; rule: Rule; threshold: number | null }

// ---- Arguments --------------------------------------------------------------------------------
const chainArgs: string[] = [];
const dirs: string[] = [];
let scale: number | null = null;
let out: string | null = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chain") chainArgs.push(argv[++i] ?? "");
    else if (a === "--scale") scale = Number(argv[++i]);
    else if (a === "--out") out = argv[++i] ?? "";
    else if (a.startsWith("--")) { console.error(USAGE); process.exit(2); }
    else dirs.push(a);
}
if (!chainArgs.length || !dirs.length || (scale !== null && !(scale > 0)) || out === "") { console.error(USAGE); process.exit(2); }

function parseStep(s: string): Step {
    // Labels never hold ":", but may hold "@" (for example "model@prompt"), so a threshold is
    // written only after a rule.
    const parts = s.trim().split(":");
    const bad = () => new Error(`cannot read chain step "${s}"; expected <label>[:any|true|false[@<threshold>]]`);
    if (!parts[0] || parts.length > 2) throw bad();
    if (parts.length === 1) return { spec: s.trim(), label: parts[0], rule: "any", threshold: null };
    const m = parts[1].match(/^(any|true|false)(?:@(\d*\.?\d+))?$/);
    if (!m) throw bad();
    const threshold = m[2] === undefined ? null : Number(m[2]);
    if (threshold !== null && !(threshold >= 0 && threshold <= 1)) throw new Error(`chain step "${s}": the threshold must be from 0 to 1`);
    return { spec: s.trim(), label: parts[0], rule: m[1] as Rule, threshold };
}
const chains: Step[][] = chainArgs.map((c) => {
    const steps = c.split(",").filter((x) => x.trim()).map(parseStep);
    if (!steps.length) throw new Error(`empty chain "${c}"`);
    return steps;
});

// ---- Recorded answers -------------------------------------------------------------------------
/** Per base label of each run: one map (item id to row) per repeat. */
interface Source { runId: string; label: string; repeats: Map<string, ResultRow>[] }
const sources: Source[] = [];
for (const d of dirs) {
    const dir = resolve(d);
    if (!existsSync(join(dir, "run.json")) || !existsSync(join(dir, "results"))) throw new Error(`${d} is not a run directory with results`);
    const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
    const byBase = new Map<string, Map<number, Map<string, ResultRow>>>();
    for (const f of readdirSync(join(dir, "results")).filter((x) => x.endsWith(".jsonl"))) {
        for (const r of readJsonl<ResultRow>(join(dir, "results", f))) {
            const base = (r.base_label as string | undefined) ?? r.label;
            const rep = (r.repeat as number | undefined) ?? 1;
            if (!byBase.has(base)) byBase.set(base, new Map());
            const reps = byBase.get(base)!;
            if (!reps.has(rep)) reps.set(rep, new Map());
            reps.get(rep)!.set(r.item_id, r);
        }
    }
    for (const [label, reps] of byBase) sources.push({ runId: run.run_id, label, repeats: [...reps.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m) });
}

function findSource(label: string): Source {
    const slash = label.indexOf("/");
    const matches = slash > 0
        ? sources.filter((s) => s.runId === label.slice(0, slash) && s.label === label.slice(slash + 1))
        : sources.filter((s) => s.label === label);
    if (!matches.length) throw new Error(`no results for "${label}"; known: ${sources.map((s) => `${s.runId}/${s.label}`).join(", ")}`);
    if (matches.length > 1) throw new Error(`"${label}" is in several runs; write it as <run id>/<label> (${matches.map((s) => `${s.runId}/${s.label}`).join(", ")})`);
    return matches[0];
}

/** The cost of one item's share of its request, at list price; null when the price is unknown. */
function itemCost(r: ResultRow): number | null {
    if (r.list_cost_usd === null || r.list_cost_usd === undefined) return null;
    return r.list_cost_usd / Math.max(1, r.request_items ?? 1);
}

// ---- Simulation -------------------------------------------------------------------------------
interface StepTotals { reached: number; settled: number; right: number; wrong: number; no_key: number; cost: number; unknown_cost: boolean }
interface ChainResult { name: string; items: number; repeats: number; steps: StepTotals[]; right: number; wrong: number; no_key: number; human: number; cost: number; unknownCostFor: string[] }

function accepts(step: Step, r: ResultRow | undefined): boolean {
    if (!r || r.answer === null || r.answer === undefined) return false;
    const threshold = step.threshold ?? r.threshold ?? 0;
    // A model asked for no confidence counts as confident.
    if (r.confidence !== null && r.confidence < threshold) return false;
    return step.rule === "any" || String(r.answer) === step.rule;
}

function simulate(chain: Step[]): ChainResult {
    const srcs = chain.map((s) => findSource(s.label));
    // Every repeat of the longest-repeated model; a model with fewer repeats cycles through its own.
    const repeats = Math.max(...srcs.map((s) => s.repeats.length));
    const ids = [...srcs[0].repeats[0].keys()];
    const empty = (): StepTotals => ({ reached: 0, settled: 0, right: 0, wrong: 0, no_key: 0, cost: 0, unknown_cost: false });
    const steps = chain.map(empty);
    let right = 0, wrong = 0, noKey = 0, human = 0;
    for (let k = 0; k < repeats; k++) {
        for (const id of ids) {
            let settled = false;
            for (let i = 0; i < chain.length && !settled; i++) {
                const reps = srcs[i].repeats;
                const r = reps[k % reps.length].get(id);
                const t = steps[i];
                t.reached++;
                if (r) {
                    const c = itemCost(r);
                    if (c === null) t.unknown_cost = true; else t.cost += c;
                }
                if (!accepts(chain[i], r)) continue;
                settled = true;
                t.settled++;
                if (!r!.truth) { t.no_key++; noKey++; }
                else if (r!.answer === r!.truth.answer) { t.right++; right++; }
                else { t.wrong++; wrong++; }
            }
            if (!settled) human++;
        }
    }
    const avg = (n: number) => n / repeats;
    return {
        name: chain.map((s) => s.spec).join(" → "),
        items: ids.length,
        repeats,
        steps: steps.map((t) => ({ ...t, reached: avg(t.reached), settled: avg(t.settled), right: avg(t.right), wrong: avg(t.wrong), no_key: avg(t.no_key), cost: avg(t.cost) })),
        right: avg(right), wrong: avg(wrong), no_key: avg(noKey), human: avg(human),
        cost: avg(steps.reduce((n, t) => n + t.cost, 0)),
        unknownCostFor: chain.filter((_, i) => steps[i].unknown_cost).map((s) => s.label),
    };
}

// ---- Report -----------------------------------------------------------------------------------
const results = chains.map(simulate);
const n = (x: number) => String(+x.toFixed(2));
const usd = (x: number) => x.toFixed(5);
const costText = (c: ChainResult, x: number) => `${usd(x)}${c.unknownCostFor.length ? ` + unknown (${c.unknownCostFor.join(", ")})` : ""}`;
const md = [
    "# Fallback chain simulation",
    "",
    `Runs: ${dirs.map((d) => resolve(d)).join(", ")}.`,
    "",
    "Each item goes to the first model of the chain; an answer the step's rule accepts settles it, anything else goes on, and after the last step the item is left for a human. Counts and costs are means over repeats. Cost is each item's share of its request at list price, for every step the item reached; a model with an unknown price adds an unknown amount. Later steps' costs are approximate, since a real chain would batch only the items that reach it.",
    "",
    `| Chain | Items | Repeats | Right | Wrong | No key | To human | Cost (USD) |${scale ? ` Cost per ${scale} items |` : ""}`,
    `|---|---|---|---|---|---|---|---|${scale ? "---|" : ""}`,
    ...results.map((c) => `| ${cellText(c.name)} | ${c.items} | ${c.repeats} | ${n(c.right)} | ${n(c.wrong)} | ${n(c.no_key)} | ${n(c.human)} | ${costText(c, c.cost)} |${scale ? ` ${costText(c, (c.cost / Math.max(1, c.items)) * scale)} |` : ""}`),
    "",
    "## Steps",
    "",
    "| Chain | Step | Reached | Settled | Right | Wrong | No key | Cost (USD) |",
    "|---|---|---|---|---|---|---|---|",
    ...results.flatMap((c, ci) => c.steps.map((t, i) =>
        `| ${cellText(c.name)} | ${i + 1}. ${cellText(chains[ci][i].spec)} | ${n(t.reached)} | ${n(t.settled)} | ${n(t.right)} | ${n(t.wrong)} | ${n(t.no_key)} | ${usd(t.cost)}${t.unknown_cost ? " + unknown" : ""} |`)),
    "",
].join("\n");
console.log(md);
if (out) {
    const file = resolve(out);
    if (existsSync(file)) throw new Error(`${file} exists; the simulation never overwrites`);
    writeAtomic(file, md);
    console.log(`written to ${file}`);
}
