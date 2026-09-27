---
name: create-cli-command
description: >
  YOU MUST load this skill when designing or adding a new command or subcommand to any
  command-line tool; including "add a command", "we need a CLI command for X", "design the
  flags for", or planning a command's arguments, defaults, prompts, output and tests.
argument-hint: "[what the new command should do]"
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [cli, command-line, design, flags]
---

Design and add a new command to a command-line tool. Treat any text after
`/create-cli-command` as the command's purpose.

Every agent taking part in this work MUST load `about-cli-command-design` first; it holds the
principles each step below applies, and this skill does not repeat them.

Steps 1 to 6 are design and produce no code. Present the design to the user (step 6) and wait
for approval before implementing. A sub-agent may perform the survey in step 2 and the
implementation in step 7; the conversation with the user stays with the orchestrator.

## Steps

### 1. Read the Intent

State, in one or two sentences, what the user will be trying to achieve when they run this
command, not what the command does internally. From that, list:

- what the user will type (arguments, and what each one's shape tells you);
- what state the command must inspect before acting;
- what it changes, if anything, and whether any of that is destructive.

Check whether this is really a new command. If an existing command already owns the same
lifecycle (creating, updating or reporting on the same thing), extending it is usually better
than adding a sibling the user must choose between; say so and let the user decide.

### 2. Survey Similar Commands

Read the tool's existing commands, starting with the ones closest to this one, and record:

- every flag they declare that this command could also need, with its exact name, short form,
  value grammar and meaning;
- how they word output, warnings, errors and confirmations;
- how they decide whether they may prompt, and what their dry-run flag is called;
- any shared helpers the codebase uses for flags, prompts, tables or output, which the new
  command must use rather than rebuild.

For each needed option, reuse the existing flag when the concept matches. When a close flag
exists whose name or definition does not quite fit, propose tweaking or renaming it (keeping
the old spelling as a hidden alias) so one definition serves both commands, rather than
inventing a near-duplicate.

### 3. Design Arguments, Flags and Defaults

- Choose defaults that serve the most common intent, inferred from what the user typed.
- Every flag either requires a value or is a boolean; split optional-value ideas in two.
- Mark contradictory flags mutually exclusive and dependent flags as depending on their
  partner.
- If the command chains other commands, accept and forward their flags.
- Documented names are full words; abbreviations, if any, are hidden aliases.
- If the command changes state across several steps or items, give it a dry-run flag and the
  tool's confirmation flag.

### 4. Decide Outcomes: Act, Warn, Error

Walk through the realistic inputs and states, and for each decide one of:

- **act** (intent is clear);
- **act and warn** (intent is somewhat ambiguous, or a best-effort step failed);
- **error** (intent is truly ambiguous, the request cannot work, or the network step is the
  point of the command and it failed).

Also decide what happens without an interactive terminal at each place the command would
ask a question: which flag answers it, and what the error says when it is missing.

For each destructive step, decide what the confirmation lists. If the command wraps another
tool, identify which of that tool's checks to rely on, and add your own check only where the
tool is silent about loss.

### 5. Plan the Output and Help

- Write the one-sentence help line for the command and for each flag.
- Draft the output for the success case, one warning case, one error case and, for a
  multi-step command, a failure midway. Show them as the user will see them.
- For a command that shows information, confirm it is read-only and offline by default, and
  that source and selection are separate flags.

### 6. Present the Design (orchestrator, with the user)

Present the command's synopsis, each flag with its help line and default, the act, warn and
error table, the drafted output, and any existing flag you propose to tweak or rename. Wait
for approval, and revise until the user gives it.

### 7. Implement

Follow the codebase's own structure for commands. Keep planning and execution in separate
code paths, so the dry run prints exactly what the real run would do. Gate every prompt
through the tool's single "may I prompt?" rule.

### 8. Test

Cover at least:

- each default, and each inference from the shape of an argument;
- each mutually exclusive pair and each dependent flag, as errors;
- the dry run changing nothing;
- declining the confirmation changing nothing;
- the non-interactive path failing with a message that names the question and the flag;
- a best-effort network step failing without failing the command, where one exists;
- the wording of at least one warning and one error.

### 9. Document

Update the tool's command reference and any user documentation in the same change.

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
