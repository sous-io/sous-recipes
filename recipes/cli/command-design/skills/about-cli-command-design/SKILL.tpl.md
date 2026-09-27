---
name: about-cli-command-design
description: >
  YOU MUST load this skill when designing, reviewing or changing any command-line interface:
  adding or renaming a command or flag, choosing defaults, writing prompts, confirmations,
  warnings, errors, help text or command output, or deciding how a command behaves offline,
  in CI or without a terminal.
user-invocable: false
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [cli, command-line, ux, flags, design]
---

These principles apply to any command-line tool in any language. They describe how a command
should read the user's intent, protect their work, name its flags, talk to the network and
report what happened. The examples use an imaginary tool called `mytool`; substitute the real
one.

Before applying any principle, read the tool's existing commands. A tool's own conventions,
once established, outrank a general principle that would make one command behave differently
from its siblings; raise the conflict with the user rather than quietly breaking consistency.

## 1. Intent and Defaults

**Infer as much as possible from what the user typed, then default for convenience.** Every
argument carries information: its shape (a path, a URL, a number, a name that exists), where
the command was run, and what state the world is in. Use all of it before asking.

```
mytool link ./checkouts/widgets     # a path: link that directory where it is
mytool link widgets                 # a known name: fetch it and link the copy
```

Grade the response to ambiguity:

- **Clear intent:** act.
- **Somewhat ambiguous intent:** act on the most likely reading, and warn, stating which
  reading was taken and how to ask for the other one.
- **Truly ambiguous intent** (two readings are equally likely and choosing wrong costs
  something): stop with an error that lists the readings and the spelling that selects each.
  In an interactive terminal, a question offering the readings is an acceptable alternative.

Never state what the user intended; state what the command did or will do.

## 2. Informed Consent, Never Prevention

The user owns the decision. The command's job is to make sure the decision is informed.

- State facts the user can verify: what exists, what would change, what would be lost.
- Confirm once, then do what was asked.
- Do not prohibit a reasonable alternative just because another way is better. Say why the
  other way is usually preferred, and proceed if the user still wants theirs.

Refusal is for requests that cannot work (a file that does not exist, two flags that
contradict each other), not for requests the tool's author would not have made.

## 3. Pass Complexity to the Underlying Tool

When a command wraps another tool (git, a package manager, a compiler, a cloud CLI), do not
re-implement the checks that tool already enforces. Run it and show its answer, verbatim or
lightly framed. A re-implemented check drifts from the real one, rejects things the real tool
accepts, and hides the real tool's precise message behind a vaguer one.

Check for yourself only where the wrapped tool is silent about loss. `git reset --hard`
discards uncommitted work without a word, so a command that runs it looks for uncommitted
changes first and lists them in its confirmation. `git push` already refuses a non-fast-forward
push with a clear message, so a command that runs it does not pre-check.

## 4. Safety: Non-Destructive by Default

- The default behavior of every command is non-destructive.
- Destructive or state-changing behavior that goes beyond what the command's name promises is
  opt-in, through a flag.
- Before a destructive step, list exactly what would be lost (files, commits, entries), not a
  generic "this may delete data".
- Ask once for the whole operation, never once per item.
- One confirmation flag answers yes (conventionally `--yes` and `-y`), and it is the same flag
  on every command in the tool.

## 5. Never Prompt Without a Terminal

A command may ask a question only when it owns an interactive terminal. It does not when:

- a non-interactive flag was passed (for example `--non-interactive`);
- a CI environment variable is set;
- standard input or standard output is not a TTY.

In those cases, fail instead of waiting forever or guessing. The error names the question that
could not be asked and the flag or environment variable that would have answered it:

```
Error: mytool needed to ask "Remove the 3 files listed above?" but it is not running in an
interactive terminal. Pass --yes to answer yes ahead of time.
```

Put one rule for "may I prompt?" in one place in the code, and gate every prompt through it.

## 6. Command Shape

**One command for one lifecycle.** A command that creates, updates or reports depending on the
current state beats several commands the user must choose between. Re-running it is safe and
does the next sensible thing: create when absent, update when stale, report when current. The
user remembers one verb for one goal.

```
mytool env sync      # creates the environment, updates it, or says it is already current
```

**Chaining commands accept the flags of the commands they call.** When `mytool release` runs
the same steps as `mytool build` and `mytool publish`, it accepts their flags and passes them
through, so nobody has to abandon the combined command to reach one option. Rename a passed-
through flag only when its name would be ambiguous in the combined command (for example
`--build-target` when `release` also has a target of its own), and keep the rename consistent.

## 7. Flags

The full treatment, with examples, is in [references/flag-design.md](references/flag-design.md).
The essentials:

- **Same concept, same name, across every command.** Different concepts get different names,
  even when the words feel close: "fetch the latest upstream state before acting" and "move to
  a newer released version" are two different flags, because one reads and the other changes.
- **A flag either requires a value or is a boolean.** A flag whose value is optional makes
  parsing ambiguous (`--branch foo` could be a value or a positional argument). Split it:
  `--create-branch <name>` for a named branch, `--generate-branch` for a generated one.
- **Contradictory flags are mutually exclusive** and passing both is an error naming both.
- **A flag that only means something alongside another depends on it**, and passing it alone
  is an error naming the flag it needs.
- **Documented names are full words.** Abbreviated spellings may exist as hidden aliases for
  people who already type them; help and docs show the full word.

## 8. Reading and the Network

The full treatment is in
[references/reading-and-network.md](references/reading-and-network.md). The essentials:

- **Commands that show information are read-only**, and by default they are offline and fast,
  answering from local data. An explicit flag reads the remote.
- **Separate where data comes from and which items are shown.** `--remote` (source) and `--all`
  (selection) are independent flags, not one flag doing both.
- **Network steps get a short timeout** and are best effort wherever the command can still
  succeed without them.
- **When a network step fails, say exactly what could not be checked and why**, quoting the
  underlying tool's reason rather than guessing ("offline" is a guess; "connection refused by
  registry.example.com" is a fact).
- **Fail only when the network step is the point of the command.**

## 9. Plan, Confirm, Execute

A command that makes several changes, or one change to several items, works out the whole plan
first, prints it, asks once, and only then executes. A dry-run flag (conventionally
`--dry-run`) prints the same plan and changes nothing. Keep the plan and the execution in
separate code paths, so the dry run is exactly the plan the real run would execute.

Planning must not itself change anything; a confirmation is worthless once the command has
already acted on what it is asking about.

## 10. Output and Errors

The full treatment is in
[references/output-and-errors.md](references/output-and-errors.md). The essentials:

- **Output states facts about what happened**, in plain, complete sentences. No terse codes,
  no private abbreviations, no status notation the reader must decode.
- **No footer hints** pointing at other commands the user might want next. Rare, deliberate
  exceptions exist (an error whose fix is one specific command), and each is a decision.
- **Errors carry a literal prefix** (for example `Error: `) so they stay findable with color
  off, in logs and in piped output. Errors and prompts go to standard error, so standard
  output stays clean for pipes.
- **A failure midway says which steps completed**, which one failed, and what state that
  leaves things in.
- **Facts and judgments are kept apart.** Report what was observed; when the tool judges it,
  label the judgment and name the rule it applies. Never call something a bug, a violation or
  wrong without a stated rule.

## 11. Help Text

Help for a command or flag describes exactly the thing it names, in one sentence. No tips, no
"see also", no cross-references to other commands. If the sentence will not fit, the command
or flag is probably doing two things.

```
--dry-run    Print the plan and change nothing.
```

## Reference Files

- [flag-design.md](references/flag-design.md): naming, value grammar, conflicts, dependencies,
  aliases, pass-through and confirmation flags, with examples
- [reading-and-network.md](references/reading-and-network.md): offline-first reads, source
  versus selection flags, timeouts, reporting what could not be checked
- [output-and-errors.md](references/output-and-errors.md): wording output, warnings versus
  errors, partial failures, facts versus judgments, before and after examples

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
