// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Combines several runs into one scores table and one item table, prints them and writes them to
// <output dir>/_comparisons/<UTC stamp>-<random>.md (the output directory of the first run given),
// or to the file given with --out. A comparison never overwrites a file.
//
// Usage: node compare.ts [--out <file.md>] <run dir>...
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readJsonl, uniqueStamp, writeAtomic } from "./lib/files.ts";
import { itemTable, LEGEND, scoresTable, tally, type ResultRow } from "./lib/report.ts";

const args = process.argv.slice(2);
let out: string | null = null;
const dirs: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else dirs.push(args[i]);
}
if (!dirs.length || (out !== null && !out)) { console.error("usage: node compare.ts [--out <file.md>] <run dir>..."); process.exit(2); }

const columns: { header: string; rows: ResultRow[] }[] = [];
const scoreLines: Parameters<typeof scoresTable>[0] = [];
const runs: string[] = [];
for (const d of dirs) {
    const dir = resolve(d);
    if (!existsSync(join(dir, "run.json"))) throw new Error(`${d} is not a run directory (no run.json)`);
    const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
    const resolved = JSON.parse(readFileSync(join(dir, "resolved.json"), "utf8"));
    const name = `${run.spec_name}/${run.run_id}`;
    runs.push(`- ${name} (${run.status}; ${dir})`);
    if (!existsSync(join(dir, "results"))) continue;
    // Plan order first (repeat labels follow their plan), then anything else in results/.
    const files = readdirSync(join(dir, "results")).filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(/\.jsonl$/, ""));
    const labels: string[] = [];
    for (const p of resolved.plans ?? []) for (const l of files) if ((l === p.label || l.startsWith(`${p.label}.r`)) && !labels.includes(l)) labels.push(l);
    for (const l of files) if (!labels.includes(l)) labels.push(l);
    for (const label of labels) {
        const rows = readJsonl<ResultRow>(join(dir, "results", `${label}.jsonl`));
        columns.push({ header: dirs.length > 1 ? `${run.run_id} ${label}` : label, rows });
        const pm = run.per_model?.[label];
        for (const g of [...new Set(rows.map((r) => r.group))]) scoreLines.push({ run: name, label, group: g, t: tally(rows.filter((r) => r.group === g)) });
        scoreLines.push({ run: name, label, group: "all", t: tally(rows), cost: pm ? pm.cost_usd : undefined, cached: pm ? `${pm.cached}/${pm.requests}` : undefined });
    }
}

const md = [
    "# Comparison",
    "",
    ...runs,
    "",
    "## Scores",
    "",
    scoresTable(scoreLines),
    "",
    "## Items",
    "",
    LEGEND,
    "",
    itemTable(columns),
    "",
].join("\n");
// A run directory is <output dir>/<spec name>/<run id>.
const file = out ? resolve(out) : join(dirname(dirname(resolve(dirs[0]))), "_comparisons", `${uniqueStamp()}.md`);
if (existsSync(file)) throw new Error(`${file} exists; comparisons never overwrite`);
writeAtomic(file, md);
console.log(md);
console.log(`written to ${file}`);
