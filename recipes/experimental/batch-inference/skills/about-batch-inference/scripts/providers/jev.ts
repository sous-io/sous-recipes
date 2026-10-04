// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Client for TypeSafe AI's Jev through DigitalOcean's System One API. Jev does not write text: it
// answers typed questions (choice, score, noul = yes/no) about a `state` object with calibrated
// probabilities. Reads DO_MODEL_ACCESS_KEY from the environment.
import { cacheKey, logCost, readCache, writeCache, type CallOptions } from "../lib/cache.ts";
import { requireEnv } from "../lib/files.ts";
import type { ProviderResult } from "./anthropic.ts";

const ENDPOINT = "https://inference.do-ai.run/v1/systemone";
export const JEV_DEFAULT_MODEL = "typesafe-jev-1.13.0";
/** US dollars per million input tokens; output is free. Check it against the current price list. */
const PRICE_IN = 0.042;

export type JevQuestion =
    | { type: "choice"; instructions: string; criteria: Record<string, string> }
    | { type: "score"; instructions: string; criteria: (string | { label: string; description?: string })[] }
    | { type: "noul"; instructions: string };

export interface JevRequest { model: string; state: unknown; questions: Record<string, JevQuestion> }

export function jevCost(usage: any): number {
    return ((usage?.input_tokens ?? 0) * PRICE_IN) / 1e6;
}

/** `cache: "bypass"` neither reads nor writes the shared cache (see callMessages). */
export async function askJev(request: JevRequest, o: CallOptions): Promise<ProviderResult> {
    const key = cacheKey(request);
    const bypass = o.cache === "bypass";
    const hit = bypass ? null : readCache(o.cacheDir, key);
    if (hit) return { data: hit.response.answers, raw: hit.response, usage: hit.response.usage, cached: true, cost_usd: 0, list_cost_usd: jevCost(hit.response.usage), cache_key: key };
    let lastError: unknown;
    const attempts = o.attempts ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { authorization: `Bearer ${requireEnv("DO_MODEL_ACCESS_KEY")}`, "content-type": "application/json" },
            body: JSON.stringify(request),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
            lastError = new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
            if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
            throw lastError;
        }
        const cost = jevCost(json.usage);
        logCost(o.costs, { at: new Date().toISOString(), job: o.job, model: request.model, usage: json.usage, cost_usd: cost, cache_key: key, ...(bypass ? { cache: "bypass" } : {}) });
        if (!bypass) writeCache(o.cacheDir, key, { request, response: json, at: new Date().toISOString() });
        return { data: json.answers, raw: json, usage: json.usage, cached: false, cost_usd: cost, list_cost_usd: cost, cache_key: key };
    }
    throw new Error(`askJev failed after ${attempts} attempts: ${String(lastError)}`);
}
