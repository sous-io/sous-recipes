// EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.
//
// Task registry. To add a task (for example a labeling task), write tasks/<name>.ts implementing
// Task from types.ts and add it here.
import { decision } from "./decision.ts";
import type { Task } from "./types.ts";

export const TASKS: Record<string, Task> = { decision };

export function getTask(name: string): Task {
    const t = TASKS[name];
    if (!t) throw new Error(`unknown task "${name}"; known: ${Object.keys(TASKS).join(", ")}`);
    return t;
}
