// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Loads items, the answer key and prompt files, picks the items a spec asks for, and builds the
// context object that goes into a request beside each item.
import { readFileSync } from "node:fs";
import { NOTICE_KEY, readJsonl } from "./files.ts";

/** One thing to judge. Every other property is a context field a spec may send beside the text. */
export interface Item { id: string; text: string; group?: string; [k: string]: unknown }

/** One line of the answer key: the human answer for an item. */
export interface KeyEntry { id: string; answer: boolean; note?: string | null }

export function loadItems(file: string): Item[] {
    const items = readJsonl<Item>(file);
    const seen = new Set<string>();
    items.forEach((it, i) => {
        if (typeof it?.id !== "string" || !it.id) throw new Error(`${file}: line ${i + 1} has no string "id"`);
        if (typeof it.text !== "string") throw new Error(`${file}: item ${it.id} has no string "text"`);
        if (it.group !== undefined && typeof it.group !== "string") throw new Error(`${file}: item ${it.id}: "group" must be a string`);
        if (seen.has(it.id)) throw new Error(`${file}: item ${it.id} appears twice`);
        seen.add(it.id);
    });
    return items;
}

export function loadAnswerKey(file: string): Map<string, KeyEntry> {
    const key = new Map<string, KeyEntry>();
    for (const k of readJsonl<KeyEntry>(file)) {
        if (typeof k?.id !== "string" || typeof k.answer !== "boolean") throw new Error(`${file}: every line needs a string "id" and a boolean "answer" (got ${JSON.stringify(k)})`);
        const prev = key.get(k.id);
        if (prev && prev.answer !== k.answer) throw new Error(`${file}: conflicting answers for ${k.id}`);
        key.set(k.id, k);
    }
    return key;
}

// ---- Context fields ---------------------------------------------------------------------------

/**
 * A context field puts one value of the item into the request's `context` object (Anthropic
 * models) or `context` state (Jev). A string names an item property (a dotted path reaches into
 * nested objects); `{ "name", "path", "default" }` sends the value at `path` under another name.
 */
export type ContextField = string | PathField;
export interface PathField { name: string; path: string; default?: unknown }
interface Resolved { name: string; path: string; default: unknown }

export function resolveContextField(f: ContextField): Resolved {
    if (typeof f === "string") {
        if (!f) throw new Error("an empty context field name");
        return { name: f, path: f, default: null };
    }
    if (typeof f?.name !== "string" || !f.name) throw new Error(`context field ${JSON.stringify(f)} needs a "name"`);
    for (const k of Object.keys(f)) if (!["name", "path", "default"].includes(k)) throw new Error(`context field "${f.name}": unknown key "${k}" (allowed: name, path, default)`);
    if (typeof f.path !== "string" || !f.path) throw new Error(`context field "${f.name}" needs a "path"`);
    return { name: f.name, path: f.path, default: f.default ?? null };
}

function getPath(obj: any, path: string): unknown {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** The `context` object for one item, or undefined when no context fields are asked for. */
export function contextFor(item: Item, fields: ContextField[]): Record<string, unknown> | undefined {
    if (!fields.length) return undefined;
    const out: Record<string, unknown> = {};
    for (const f of fields.map(resolveContextField)) out[f.name] = getPath(item, f.path) ?? f.default;
    return out;
}

// ---- Prompts ----------------------------------------------------------------------------------

/**
 * Renders a prompt template. `{{! comment }}` is removed (with the line break after it, so a
 * comment on its own line leaves no blank line). `{{#if flag}}...{{/if}}` keeps its text only when
 * the flag is true, `{{#unless flag}}...{{/unless}}` only when it is false; blocks may nest. The
 * file's final newline is not part of the prompt.
 */
export function renderTemplate(file: string, flags: Record<string, boolean>): string {
    let text = readFileSync(file, "utf8").replace(/\{\{![\s\S]*?\}\}\n?/g, "").replace(/\n$/, "");
    // Innermost blocks first (a body holds no further opening tag), until none are left.
    const block = /\{\{#(if|unless) (\w+)\}\}((?:(?!\{\{#)[\s\S])*?)\{\{\/\1\}\}/g;
    for (let prev = ""; prev !== text; ) {
        prev = text;
        text = text.replace(block, (_, kind: string, flag: string, body: string) => {
            if (!(flag in flags)) throw new Error(`${file}: unknown template flag "${flag}"`);
            return flags[flag] === (kind === "if") ? body : "";
        });
    }
    if (/\{\{/.test(text)) throw new Error(`${file}: unrendered template tag`);
    return text;
}

/** A Jev prompt spec: the `state` fields Jev sees beside the item, and the `questions`. */
export function readPromptJson(file: string): { state: Record<string, unknown>; questions: Record<string, any> } {
    const json = JSON.parse(readFileSync(file, "utf8"));
    for (const k of Object.keys(json)) if (!["state", "questions", NOTICE_KEY].includes(k)) throw new Error(`${file}: unknown key "${k}" (allowed: state, questions)`);
    if (!json.questions || typeof json.questions !== "object") throw new Error(`${file}: needs a "questions" object`);
    return { state: json.state ?? {}, questions: json.questions };
}

// ---- Item selection ---------------------------------------------------------------------------

export interface Selection {
    /** The items file (JSONL). */
    file?: string;
    /** These items, in this order. Without it, every item in file order. */
    ids?: string[];
    /** Only items whose `group` is one of these (an item without a group is in group "all"). */
    groups?: string[];
    /** Only items the answer key has an answer for. */
    only_keyed?: boolean;
    /** Only items the answer key has no answer for. */
    exclude_keyed?: boolean;
    /** A seeded random sample of what the filters above leave. */
    sample?: { n: number; seed: number };
}

export const SELECTION_KEYS = ["file", "ids", "groups", "only_keyed", "exclude_keyed", "sample"];

export interface Selected { item: Item; group: string }

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Returns the selected items in order, each with its group. */
export function selectItems(all: Item[], sel: Selection, key: Map<string, KeyEntry> | null): Selected[] {
    const byId = new Map(all.map((i) => [i.id, i]));
    let pool: Item[] = sel.ids
        ? sel.ids.map((id) => { const it = byId.get(id); if (!it) throw new Error(`unknown item ${id}`); return it; })
        : [...all];
    const groupOf = (i: Item) => i.group ?? "all";
    if (sel.groups) pool = pool.filter((i) => sel.groups!.includes(groupOf(i)));
    if (sel.only_keyed) pool = pool.filter((i) => key?.has(i.id));
    if (sel.exclude_keyed) pool = pool.filter((i) => !key?.has(i.id));
    if (sel.sample) {
        const { n, seed } = sel.sample;
        if (!Number.isInteger(n) || n < 1 || !Number.isInteger(seed)) throw new Error("items.sample needs an integer n of at least 1 and an integer seed");
        pool = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const rand = mulberry32(seed);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        pool = pool.slice(0, n);
    }
    const seen = new Set<string>();
    for (const i of pool) {
        if (seen.has(i.id)) throw new Error(`item ${i.id} is selected twice`);
        seen.add(i.id);
    }
    if (!pool.length) throw new Error("the selection is empty");
    return pool.map((item) => ({ item, group: groupOf(item) }));
}
