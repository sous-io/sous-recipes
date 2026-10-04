// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// File helpers that are safe when several runs work at once: whole-file writes go to a temporary
// file in the same directory and are renamed into place (readers see the old file or the new one,
// never a partial one), and log lines are appended with one write call each.
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The key that marks a notice in a data file; the loaders skip it. */
export const NOTICE_KEY = "_experimental";

export function writeAtomic(file: string, content: string): void {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = join(dirname(file), `.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
    try {
        writeFileSync(tmp, content);
        renameSync(tmp, file);
    } catch (e) {
        rmSync(tmp, { force: true });
        throw e;
    }
}

export function writeJson(file: string, value: unknown): void {
    writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
}

/** Appends whole lines in one write call, so lines from parallel writers never interleave. */
export function appendLines(file: string, values: unknown[]): void {
    if (!values.length) return;
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, values.map((v) => JSON.stringify(v) + "\n").join(""));
}

/**
 * Reads a JSONL file. A line whose only key is `_experimental` is a notice, not data, and is
 * skipped, so example data files can carry the experimental notice.
 */
export function readJsonl<T = any>(file: string): T[] {
    return readFileSync(file, "utf8")
        .split("\n")
        .map((l, i) => {
            if (!l.trim()) return undefined;
            try { return JSON.parse(l); } catch (e) { throw new Error(`${file}:${i + 1}: invalid JSON (${(e as Error).message})`); }
        })
        .filter((v) => v !== undefined && !(v && typeof v === "object" && Object.keys(v).length === 1 && NOTICE_KEY in v));
}

/** UTC timestamp plus a random suffix, for run and comparison names that never collide. */
export function uniqueStamp(): string {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z") + "-" + randomBytes(3).toString("hex");
}

/** Credentials come from the environment only. */
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set in the environment`);
    return value;
}
