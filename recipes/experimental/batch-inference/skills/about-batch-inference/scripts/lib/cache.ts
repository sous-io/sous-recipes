// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Content-addressed response cache shared by every run: the key is the sha256 of the request as
// JSON, so identical requests reuse one answer and differing requests never collide. Entries are
// written atomically; an unreadable entry (for example one cut short by a crashed writer) is treated
// as a miss and replaced.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendLines, writeJson } from "./files.ts";

export function cacheKey(request: unknown): string {
    return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

export function cacheFile(dir: string, key: string): string {
    return join(dir, `${key}.json`);
}

export function readCache(dir: string, key: string): any | null {
    const file = cacheFile(dir, key);
    if (!existsSync(file)) return null;
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    } catch {
        process.stderr.write(`warning: unreadable cache entry ${file}; treating it as a miss\n`);
        return null;
    }
}

export function writeCache(dir: string, key: string, entry: unknown): void {
    writeJson(cacheFile(dir, key), entry);
}

/** Where paid calls are logged: the run's own log and a log shared by every run. */
export interface CostSink { runCostFile: string | null; sharedCostFile: string | null }

/** One line per paid call, in the shared log and in the run's own log. */
export function logCost(sink: CostSink, line: Record<string, unknown>): void {
    if (sink.sharedCostFile) appendLines(sink.sharedCostFile, [line]);
    if (sink.runCostFile) appendLines(sink.runCostFile, [line]);
}

/** "use" reads and writes the shared response cache; "bypass" neither reads nor writes it. */
export type CacheMode = "use" | "bypass";

export interface CallOptions {
    /** A name for the call in the cost log. */
    job: string;
    cacheDir: string;
    costs: CostSink;
    cache: CacheMode;
    attempts?: number;
}
