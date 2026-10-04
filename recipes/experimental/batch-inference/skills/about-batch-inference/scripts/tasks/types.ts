// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// The interface every task module implements. A task says how to ask Anthropic models and Jev its
// question, how to read their answers, and what an answer key entry means as an answer. Scoring,
// batching, caching and reports are shared by the runner.
import type { ContextField, Item, KeyEntry } from "../lib/data.ts";
import type { JevQuestion } from "../providers/jev.ts";

export interface Answer {
    /** The yes/no answer that is scored. */
    answer: boolean | null;
    /** 0 to 1, or null when the model gave none (a model asked for none counts as confident). */
    confidence: number | null;
    /** Task-specific detail kept in the results. */
    detail?: Record<string, unknown>;
}

export interface Truth { answer: boolean }

export interface AnthropicOptions { withConfidence: boolean }

export interface Task {
    name: string;
    /** Context fields used when the spec names none. */
    defaultContext: ContextField[];
    anthropic: {
        /** Template flags this task sets from the spec (the decision task: with_confidence). */
        flags(o: AnthropicOptions): Record<string, boolean>;
        /** The user message for one batch of items. */
        user(items: Item[], context: ContextField[]): string;
        /** The structured-output JSON Schema. */
        schema(o: AnthropicOptions): object;
        /** Validates a reply for these item ids; throws when it does not fit. */
        validate(data: unknown, ids: string[], o: AnthropicOptions): unknown;
        /** Answers keyed by item id. */
        parse(data: unknown, o: AnthropicOptions): Map<string, Answer>;
    };
    jev: {
        /** The noul question whose probability is the answer, unless the spec names another. */
        defaultDecisionQuestion: string;
        state(promptState: Record<string, unknown>, item: Item, context: ContextField[]): unknown;
        parse(answers: Record<string, any>, decisionQuestion: string, questions: Record<string, JevQuestion>): Answer;
    };
    truth(k: KeyEntry): Truth;
}
