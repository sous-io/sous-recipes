// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Task "decision": a yes/no question about each item. The prompt states the question; Anthropic
// models return `{ id, decision, confidence }` per item, Jev answers one noul question whose
// probability is the decision. The answer key's `answer` is the right decision.
import { contextFor, type ContextField, type Item } from "../lib/data.ts";
import type { Answer, Task } from "./types.ts";

/** What an item looks like inside a request. The loader's own fields stay out. */
function requestItem(item: Item, context: ContextField[]): Record<string, unknown> {
    const ctx = contextFor(item, context);
    return ctx === undefined ? { id: item.id, text: item.text } : { id: item.id, text: item.text, context: ctx };
}

export const decision: Task = {
    name: "decision",
    defaultContext: [],
    anthropic: {
        flags: ({ withConfidence }) => ({ with_confidence: withConfidence }),
        user(items, context) {
            return "Items:\n" + JSON.stringify(items.map((i) => requestItem(i, context)), null, 2);
        },
        // Key order matters: the schema is part of the request and so of the cache key.
        schema: ({ withConfidence }) => ({
            type: "object",
            properties: {
                results: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            decision: { type: "boolean" },
                            ...(withConfidence ? { confidence: { type: "integer" } } : {}),
                        },
                        required: ["id", "decision", ...(withConfidence ? ["confidence"] : [])],
                        additionalProperties: false,
                    },
                },
            },
            required: ["results"],
            additionalProperties: false,
        }),
        validate(data: any, ids, { withConfidence }) {
            if (!Array.isArray(data?.results) || data.results.length !== ids.length) throw new Error(`expected ${ids.length} results`);
            const got = new Set(data.results.map((r: any) => r.id));
            for (const id of ids) if (!got.has(id)) throw new Error(`missing result for ${id}`);
            for (const r of data.results) {
                if (typeof r.decision !== "boolean") throw new Error(`result for ${r.id} has no boolean "decision"`);
                if (withConfidence && !(Number.isInteger(r.confidence) && r.confidence >= 0 && r.confidence <= 100)) throw new Error(`result for ${r.id} has no integer "confidence" from 0 to 100`);
            }
            return data;
        },
        parse(data: any): Map<string, Answer> {
            const out = new Map<string, Answer>();
            for (const r of data.results) {
                const confidence = typeof r.confidence === "number" ? r.confidence / 100 : null;
                out.set(r.id, { answer: r.decision, confidence, detail: { stated_confidence: r.confidence ?? null } });
            }
            return out;
        },
    },
    jev: {
        defaultDecisionQuestion: "decision",
        state(promptState, item, context) {
            const ctx = contextFor(item, context);
            return ctx === undefined ? { ...promptState, item: item.text } : { ...promptState, item: item.text, context: ctx };
        },
        parse(answers, question): Answer {
            const p = Number(answers?.[question]?.noul);
            if (!Number.isFinite(p)) throw new Error(`Jev gave no noul probability for "${question}"`);
            return { answer: p >= 0.5, confidence: Math.max(p, 1 - p), detail: { p_true: p } };
        },
    },
    truth: (k) => ({ answer: k.answer }),
};
