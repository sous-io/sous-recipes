// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Anthropic Messages API client: structured output with a plain-JSON fallback, retries on rate
// limits and server errors, the shared response cache and cost logging. Reads ANTHROPIC_API_KEY
// from the environment.
import { cacheKey, logCost, readCache, writeCache, type CallOptions } from "../lib/cache.ts";
import { requireEnv } from "../lib/files.ts";

/**
 * List prices in US dollars per million tokens (input, output). Check them against the provider's
 * current price list before trusting a cost figure. A model missing here has an unknown price: its
 * calls record tokens and a null cost, never 0.
 */
export const PRICES: Record<string, [number, number]> = {
    "claude-sonnet-5-5": [2, 10],
    "claude-opus-5-5": [4, 20],
};

/** Model names the harness sends to the Anthropic API. */
export function isAnthropicModel(model: string): boolean {
    return /^claude-[a-z0-9.-]+$/.test(model);
}

export interface MessagesRequest {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
    output_config?: { format: { type: "json_schema"; schema: object } };
}

export function buildRequest(o: { model: string; maxTokens: number; system: string; user: string; schema?: object }): MessagesRequest {
    // Key order matters: it is part of the cache key.
    const request: MessagesRequest = { model: o.model, max_tokens: o.maxTokens, system: o.system, messages: [{ role: "user", content: o.user }] };
    if (o.schema) request.output_config = { format: { type: "json_schema", schema: o.schema } };
    return request;
}

export interface ProviderResult {
    data: unknown;
    raw: unknown;
    usage: any;
    cached: boolean;
    /** Money spent by this call in this run: 0 on a cache hit, null when the price is unknown. */
    cost_usd: number | null;
    /** What the call costs at list price, cached or not; null when the price is unknown. */
    list_cost_usd: number | null;
    cache_key: string;
    sent_request?: unknown;
}

export function listCost(model: string, usage: any): number | null {
    const price = PRICES[model];
    if (!price || !usage) return null;
    return (usage.input_tokens * price[0] + usage.output_tokens * price[1]) / 1e6;
}

/** Pulls the first JSON object or array out of a text reply (models sometimes wrap it in a fence). */
export function parseJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = (fenced ? fenced[1] : text).trim();
    const start = body.search(/[[{]/);
    return JSON.parse(start > 0 ? body.slice(start) : body);
}

async function post(body: object): Promise<any> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": requireEnv("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status}: ${json?.error?.message ?? "no message"}`) as Error & { status: number };
        err.status = res.status;
        throw err;
    }
    return json;
}

/**
 * Sends one request (or answers it from the cache). `cache: "bypass"` neither reads nor writes the
 * shared cache: every call is paid, and its answer stays only in the run directory, so it never
 * replaces an entry other runs rely on.
 */
export async function callMessages(request: MessagesRequest, validate: (v: unknown) => unknown, o: CallOptions): Promise<ProviderResult> {
    const key = cacheKey(request);
    const bypass = o.cache === "bypass";
    const hit = bypass ? null : readCache(o.cacheDir, key);
    if (hit) {
        return { data: validate(parseJson(hit.text)), raw: hit.text, usage: hit.usage, cached: true, cost_usd: 0, list_cost_usd: listCost(request.model, hit.usage), cache_key: key };
    }
    // The cache key stays that of the original request even when the fallback below changes it.
    const sent: any = structuredClone(request);
    let lastError: unknown;
    const attempts = o.attempts ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        let response: any;
        try {
            response = await post(sent);
        } catch (e: any) {
            // Fall back to plain JSON in the text when the model refuses structured output.
            if (e.status === 400 && sent.output_config && /output_config|format|schema/i.test(e.message)) {
                const schema = sent.output_config.format.schema;
                delete sent.output_config;
                sent.system += "\n\nReply with JSON only, matching this JSON Schema:\n" + JSON.stringify(schema);
                lastError = e;
                attempt--; // the fallback happens at most once, so it does not use up an attempt
                continue;
            }
            if (e.status === 429 || e.status >= 500) { lastError = e; await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
            throw e;
        }
        const text = (response.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
        const usage = response.usage;
        const cost = listCost(request.model, usage);
        logCost(o.costs, { at: new Date().toISOString(), job: o.job, model: request.model, usage, cost_usd: cost, cache_key: key, ...(bypass ? { cache: "bypass" } : {}) });
        try {
            const data = validate(parseJson(text));
            if (!bypass) writeCache(o.cacheDir, key, { request: sent, text, usage, model: request.model, at: new Date().toISOString(), response_id: response.id ?? null, stop_reason: response.stop_reason ?? null });
            return { data, raw: text, usage, cached: false, cost_usd: cost, list_cost_usd: cost, cache_key: key, sent_request: sent };
        } catch (e) {
            lastError = e;
        }
    }
    throw new Error(`callMessages failed after ${attempts} attempts: ${String(lastError)}`);
}
