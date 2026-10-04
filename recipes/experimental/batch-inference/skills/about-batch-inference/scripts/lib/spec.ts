// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// The experiment spec: the single input of a run. See README.md for the format. Unknown keys are
// refused, so a typo never silently falls back to a default.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getTask } from "../tasks/index.ts";
import type { Task } from "../tasks/types.ts";
import { isAnthropicModel } from "../providers/anthropic.ts";
import { JEV_DEFAULT_MODEL } from "../providers/jev.ts";
import type { CacheMode } from "./cache.ts";
import { readPromptJson, resolveContextField, SELECTION_KEYS, type ContextField, type Selection } from "./data.ts";
import { NOTICE_KEY } from "./files.ts";

export interface ModelEntry {
    model: string;
    label?: string;
    prompt?: string;
    context?: ContextField[];
    with_confidence?: boolean;
    threshold?: number;
    batch_size?: number;
    max_tokens?: number;
    decision_question?: string;
    jev_model?: string;
}

export interface Spec {
    name: string;
    task: string;
    notes?: string;
    models: (string | ModelEntry)[];
    prompts?: { anthropic?: string; jev?: string };
    context?: ContextField[];
    with_confidence?: boolean;
    threshold?: number;
    batch_size?: number;
    max_tokens?: number;
    items: Selection;
    answer_key?: { file: string };
    prompts_dir?: string;
    cache_dir?: string;
    output_dir?: string;
    concurrency?: number;
    repeats?: number;
    cache?: CacheMode;
}

export interface ModelPlan {
    label: string;
    model: string;
    provider: "anthropic" | "jev";
    /** The prompt as the spec names it, relative to the prompts directory. */
    prompt: string;
    /** The prompt file's absolute path. */
    prompt_path: string;
    context: ContextField[];
    with_confidence: boolean;
    threshold: number;
    batch_size: number;
    max_tokens: number;
    decision_question: string | null;
    jev_model: string | null;
}

/** Paths given on the command line; they win over the spec and resolve against the current directory. */
export interface PathOverrides { items?: string; answerKey?: string; promptsDir?: string; cacheDir?: string; outputDir?: string }

export interface ResolvedPaths { items: string; answer_key: string | null; prompts_dir: string; cache_dir: string; output_dir: string }

export interface Resolved { task: Task; plans: ModelPlan[]; paths: ResolvedPaths; concurrency: number; repeats: number; cache: CacheMode }

const SPEC_KEYS = [NOTICE_KEY, "name", "task", "notes", "models", "prompts", "context", "with_confidence", "threshold", "batch_size", "max_tokens", "items", "answer_key", "prompts_dir", "cache_dir", "output_dir", "concurrency", "repeats", "cache"];
const ENTRY_KEYS = ["model", "label", "prompt", "context", "with_confidence", "threshold", "batch_size", "max_tokens", "decision_question", "jev_model"];

function checkKeys(obj: object, allowed: string[], where: string): void {
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) throw new Error(`${where}: unknown key "${k}" (allowed: ${allowed.filter((a) => a !== NOTICE_KEY).join(", ")})`);
}

/**
 * Resolves a spec. Paths in the spec resolve against `specDir` (the spec file's directory); paths
 * in `overrides` resolve against the current directory.
 */
export function resolveSpec(spec: Spec, specDir: string, overrides: PathOverrides = {}): Resolved {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("the spec must be a JSON object");
    checkKeys(spec, SPEC_KEYS, "spec");
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(spec.name ?? "")) throw new Error("spec.name must be lower-case letters, digits, '.', '_' or '-'");
    const task = getTask(spec.task);
    if (!Array.isArray(spec.models) || !spec.models.length) throw new Error("spec.models must list at least one model");
    if (!spec.items || typeof spec.items !== "object") throw new Error("spec.items is required");
    checkKeys(spec.items, SELECTION_KEYS, "spec.items");
    if (spec.prompts) checkKeys(spec.prompts, ["anthropic", "jev"], "spec.prompts");
    if (spec.answer_key) checkKeys(spec.answer_key, ["file"], "spec.answer_key");

    const fromSpec = (p: string | undefined) => (p === undefined ? undefined : resolve(specDir, p));
    const fromCwd = (p: string | undefined) => (p === undefined ? undefined : resolve(p));
    const itemsFile = fromCwd(overrides.items) ?? fromSpec(spec.items.file);
    if (!itemsFile) throw new Error("no items file: set items.file in the spec or pass --items");
    if (!existsSync(itemsFile)) throw new Error(`items file ${itemsFile} does not exist`);
    const answerKey = fromCwd(overrides.answerKey) ?? fromSpec(spec.answer_key?.file) ?? null;
    if (answerKey && !existsSync(answerKey)) throw new Error(`answer key ${answerKey} does not exist`);
    const paths: ResolvedPaths = {
        items: itemsFile,
        answer_key: answerKey,
        prompts_dir: fromCwd(overrides.promptsDir) ?? fromSpec(spec.prompts_dir) ?? specDir,
        cache_dir: fromCwd(overrides.cacheDir) ?? fromSpec(spec.cache_dir) ?? resolve("eval-data", "cache"),
        output_dir: fromCwd(overrides.outputDir) ?? fromSpec(spec.output_dir) ?? resolve("eval-data", "runs"),
    };

    const plans: ModelPlan[] = spec.models.map((m, i) => {
        const e: ModelEntry = typeof m === "string" ? { model: m } : m;
        checkKeys(e, ENTRY_KEYS, `spec.models[${i}]`);
        const where = `spec.models[${i}] (${e.model})`;
        const provider = e.model === "jev" ? "jev" : isAnthropicModel(e.model) ? "anthropic" : null;
        if (!provider) throw new Error(`${where}: unknown model; use "jev" or an Anthropic model name starting with "claude-"`);
        if (provider === "anthropic" && (e.decision_question !== undefined || e.jev_model !== undefined)) throw new Error(`${where}: decision_question and jev_model apply to jev only`);
        const prompt = e.prompt ?? spec.prompts?.[provider];
        if (!prompt) throw new Error(`${where}: no prompt; set "prompt" on the entry or prompts.${provider}`);
        const promptPath = resolve(paths.prompts_dir, prompt);
        if (!existsSync(promptPath)) throw new Error(`${where}: prompt file ${promptPath} does not exist`);
        let decisionQuestion: string | null = null;
        if (provider === "jev") {
            decisionQuestion = e.decision_question ?? task.jev.defaultDecisionQuestion;
            const q = readPromptJson(promptPath).questions[decisionQuestion];
            if (q?.type !== "noul") throw new Error(`${where}: ${promptPath} has no noul question "${decisionQuestion}"`);
        }
        const context = e.context ?? spec.context ?? task.defaultContext;
        if (!Array.isArray(context)) throw new Error(`${where}: context must be a list`);
        context.forEach(resolveContextField); // fails early on a malformed field
        const threshold = e.threshold ?? spec.threshold ?? 0.75;
        if (!(threshold >= 0 && threshold <= 1)) throw new Error(`${where}: threshold must be from 0 to 1`);
        return {
            label: e.label ?? "",
            model: e.model,
            provider,
            prompt,
            prompt_path: promptPath,
            context,
            with_confidence: e.with_confidence ?? spec.with_confidence ?? true,
            threshold,
            batch_size: e.batch_size ?? spec.batch_size ?? 10,
            max_tokens: e.max_tokens ?? spec.max_tokens ?? 4096,
            decision_question: decisionQuestion,
            jev_model: provider === "jev" ? (e.jev_model ?? JEV_DEFAULT_MODEL) : null,
        } satisfies ModelPlan;
    });
    // Default labels: the model name, plus the prompt file when one model appears more than once.
    for (const p of plans) {
        if (p.label) continue;
        const twins = plans.filter((q) => q.model === p.model).length;
        p.label = twins > 1 ? `${p.model}@${p.prompt.replace(/[/\\]/g, "-").replace(/\.(md|json)$/, "")}` : p.model;
    }
    const labels = plans.map((p) => p.label);
    for (const l of labels) {
        if (labels.filter((x) => x === l).length > 1) throw new Error(`model label "${l}" is used twice; give the entries distinct "label"s`);
        if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(l)) throw new Error(`model label "${l}" may only use letters, digits, '.', '_', '@' or '-'`);
    }
    const concurrency = spec.concurrency ?? 4;
    if (!(Number.isInteger(concurrency) && concurrency >= 1)) throw new Error("spec.concurrency must be an integer of at least 1");
    const repeats = spec.repeats ?? 1;
    if (!Number.isInteger(repeats) || repeats < 1) throw new Error("spec.repeats must be an integer of at least 1");
    const cache = spec.cache ?? "use";
    if (cache !== "use" && cache !== "bypass") throw new Error(`spec.cache must be "use" or "bypass"`);
    // With the cache in use, every repeat would get the same cached answer.
    if (repeats > 1 && cache !== "bypass") throw new Error(`spec.repeats above 1 needs "cache": "bypass"`);
    return { task, plans, paths, concurrency, repeats, cache };
}
