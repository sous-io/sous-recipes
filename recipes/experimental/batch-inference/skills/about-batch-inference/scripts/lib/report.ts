// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Verdicts, score tallies and Markdown tables, shared by run.ts and compare.ts.

export type Verdict = "right" | "wrong" | "unsure" | "no-key" | "error";

export interface ResultRow {
    label: string;
    model: string;
    group: string;
    item_id: string;
    item: { id: string; text: string; [k: string]: unknown };
    answer: boolean | null;
    confidence: number | null;
    threshold: number;
    verdict: Verdict;
    correct: boolean | null;
    truth: { answer: boolean; note: string | null } | null;
    /** The request's cost at list price, cached or not (shared by every item of the request). */
    list_cost_usd: number | null;
    /** How many items the request held. */
    request_items: number;
    [k: string]: unknown;
}

/**
 * The verdict for one answer. Below the threshold the verdict is "unsure" (neither right nor wrong,
 * though `correct` still records which way it leaned). A model asked for no confidence counts as
 * confident.
 */
export function verdictFor(answer: boolean | null, confidence: number | null, threshold: number, truth: { answer: boolean } | null): { verdict: Verdict; correct: boolean | null } {
    if (answer === null) return { verdict: "error", correct: null };
    if (!truth) return { verdict: "no-key", correct: null };
    const correct = answer === truth.answer;
    if (confidence !== null && confidence < threshold) return { verdict: "unsure", correct };
    return { verdict: correct ? "right" : "wrong", correct };
}

export interface Tally { n: number; right: number; unsure: number; wrong: number; no_key: number; error: number; unsure_right: number; unsure_wrong: number }

export function tally(rows: ResultRow[]): Tally {
    const t: Tally = { n: 0, right: 0, unsure: 0, wrong: 0, no_key: 0, error: 0, unsure_right: 0, unsure_wrong: 0 };
    for (const r of rows) {
        t.n++;
        if (r.verdict === "right") t.right++;
        else if (r.verdict === "wrong") t.wrong++;
        else if (r.verdict === "unsure") { t.unsure++; if (r.correct) t.unsure_right++; else t.unsure_wrong++; }
        else if (r.verdict === "no-key") t.no_key++;
        else t.error++;
    }
    return t;
}

/** Tallies per model label: all items, and per group. */
export function scoreRows(rows: ResultRow[]): Record<string, { all: Tally; groups: Record<string, Tally> }> {
    const out: Record<string, { all: Tally; groups: Record<string, Tally> }> = {};
    for (const label of [...new Set(rows.map((r) => r.label))]) {
        const mine = rows.filter((r) => r.label === label);
        const groups: Record<string, Tally> = {};
        for (const g of [...new Set(mine.map((r) => r.group))]) groups[g] = tally(mine.filter((r) => r.group === g));
        out[label] = { all: tally(mine), groups };
    }
    return out;
}

const MARK: Record<Verdict, string> = { right: "✓", wrong: "✗", unsure: "?", "no-key": "·", error: "!" };
export const LEGEND = "Marks: ✓ right, ✗ wrong, ? unsure (confidence below the threshold; neither right nor wrong), · no answer key entry, ! error. A cell reads answer, confidence, mark.";

export function cellText(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function cell(r: ResultRow | undefined): string {
    if (!r) return "";
    if (r.verdict === "error") return MARK.error;
    const yn = r.answer ? "Y" : "N";
    const conf = r.confidence === null ? "" : ` ${Math.round(r.confidence * 100)}%`;
    return `${yn}${conf} ${MARK[r.verdict]}`;
}

/** One row per item, one column per (header, rows) pair. */
export function itemTable(columns: { header: string; rows: ResultRow[] }[]): string {
    const order: { id: string; group: string; text: string; truth: ResultRow["truth"] }[] = [];
    const seen = new Set<string>();
    for (const c of columns) for (const r of c.rows) if (!seen.has(r.item_id)) {
        seen.add(r.item_id);
        order.push({ id: r.item_id, group: r.group, text: r.item.text, truth: r.truth });
    }
    const maps = columns.map((c) => new Map(c.rows.map((r) => [r.item_id, r])));
    const lines = [
        `| # | Group | Item | Key | ${columns.map((c) => cellText(c.header)).join(" | ")} |`,
        `|---|---|---|---|${columns.map(() => "---").join("|")}|`,
    ];
    order.forEach((s, i) => {
        const key = s.truth ? (s.truth.answer ? "Y" : "N") : "";
        lines.push(`| ${i + 1} | ${cellText(s.group)} | ${cellText(s.id)}: "${cellText(s.text)}" | ${key} | ${maps.map((m) => cell(m.get(s.id))).join(" | ")} |`);
    });
    return lines.join("\n");
}

export function formatCost(cost: number | null | undefined): string {
    return cost === undefined ? "" : cost === null ? "unknown" : cost.toFixed(5);
}

export function scoresTable(rows: { run?: string; label: string; group: string; t: Tally; cost?: number | null; cached?: string }[]): string {
    const withRun = rows.some((r) => r.run);
    const head = `| ${withRun ? "Run | " : ""}Model | Group | Right | Unsure | Wrong | No key | Errors | Cost (USD) | Cached calls |`;
    const sep = `|${withRun ? "---|" : ""}---|---|---|---|---|---|---|---|---|`;
    const body = rows.map((r) =>
        `| ${withRun ? cellText(r.run!) + " | " : ""}${cellText(r.label)} | ${cellText(r.group)} | ${r.t.right} | ${r.t.unsure} | ${r.t.wrong} | ${r.t.no_key} | ${r.t.error} | ${formatCost(r.cost)} | ${r.cached ?? ""} |`);
    return [head, sep, ...body].join("\n");
}

// ---- Repeats ----------------------------------------------------------------------------------

export interface RepeatScore { repeat: number; n: number; right: number; unsure: number; wrong: number; no_key: number; error: number }

export interface RepeatsSummary {
    repeats: number;
    /** The score of each repeat. */
    per_repeat: RepeatScore[];
    /** Mean right, unsure, wrong and error counts across repeats. */
    mean: { right: number; unsure: number; wrong: number; error: number };
    /** The repeat with the fewest right answers (ties: the most wrong, then the most errors). */
    worst: RepeatScore;
    /** Items on which every repeat gave the same answer (an error never agrees). */
    unanimous: number;
    n: number;
    /** Per item: each repeat's answer, confidence and verdict, and the share of the majority answer. */
    items: { id: string; answers: (boolean | null)[]; confidences: (number | null)[]; verdicts: Verdict[]; agreement: number; unanimous: boolean }[];
}

/** Per model label, the agreement across repeats and the score of each repeat, the mean and the worst. */
export function repeatsSummary(models: { label: string; repeats: ResultRow[][] }[]): Record<string, RepeatsSummary> {
    const out: Record<string, RepeatsSummary> = {};
    for (const { label, repeats } of models) {
        const per_repeat = repeats.map((rows, i) => {
            const t = tally(rows);
            return { repeat: i + 1, n: t.n, right: t.right, unsure: t.unsure, wrong: t.wrong, no_key: t.no_key, error: t.error };
        });
        const mean = (k: "right" | "unsure" | "wrong" | "error") => per_repeat.reduce((n, r) => n + r[k], 0) / per_repeat.length;
        const worst = [...per_repeat].sort((a, b) => a.right - b.right || b.wrong - a.wrong || b.error - a.error)[0];
        const maps = repeats.map((rows) => new Map(rows.map((r) => [r.item_id, r])));
        const items = repeats[0].map((first) => {
            const rows = maps.map((m) => m.get(first.item_id));
            const answers = rows.map((r) => r?.answer ?? null);
            const yes = answers.filter((a) => a === true).length, no = answers.filter((a) => a === false).length;
            return {
                id: first.item_id,
                answers,
                confidences: rows.map((r) => r?.confidence ?? null),
                verdicts: rows.map((r) => r?.verdict ?? "error"),
                agreement: Math.max(yes, no) / answers.length,
                unanimous: yes === answers.length || no === answers.length,
            };
        });
        out[label] = {
            repeats: repeats.length, per_repeat,
            mean: { right: mean("right"), unsure: mean("unsure"), wrong: mean("wrong"), error: mean("error") },
            worst, unanimous: items.filter((s) => s.unanimous).length, n: items.length, items,
        };
    }
    return out;
}

export function repeatsTable(summary: Record<string, RepeatsSummary>): string {
    const fmt = (r: { right: number; unsure: number; wrong: number }) => `${r.right}/${r.unsure}/${r.wrong}`;
    const lines = [
        "Scores read right/unsure/wrong. Agreement: items on which every repeat gave the same answer.",
        "",
        "| Model | Repeats | Each repeat | Mean | Worst | Agreement |",
        "|---|---|---|---|---|---|",
    ];
    for (const [label, s] of Object.entries(summary)) {
        const mean = { right: +s.mean.right.toFixed(2), unsure: +s.mean.unsure.toFixed(2), wrong: +s.mean.wrong.toFixed(2) };
        lines.push(`| ${cellText(label)} | ${s.repeats} | ${s.per_repeat.map(fmt).join(", ")} | ${fmt(mean)} | ${fmt(s.worst)} (r${s.worst.repeat}) | ${s.unanimous}/${s.n} |`);
    }
    const disagreements = Object.entries(summary).flatMap(([label, s]) => s.items.filter((x) => !x.unanimous).map((x) =>
        `| ${cellText(label)} | ${cellText(x.id)} | ${x.answers.map((a, i) => `${a === null ? "!" : a ? "Y" : "N"}${x.confidences[i] === null ? "" : ` ${Math.round(x.confidences[i]! * 100)}%`}`).join(", ")} |`));
    if (disagreements.length) lines.push("", "Items the repeats disagree on:", "", "| Model | Item | Answers by repeat |", "|---|---|---|", ...disagreements);
    return lines.join("\n");
}
