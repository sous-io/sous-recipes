---
name: update-cli-command
description: >
  YOU MUST load this skill when changing an existing command in any command-line tool;
  including adding, renaming, removing or redefining a flag, changing a default, output format,
  exit code or prompt, or deprecating a command, so that existing users and scripts keep
  working.
argument-hint: "[the command, and the change wanted]"
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [cli, command-line, compatibility, deprecation]
---

Change an existing command without breaking the people and scripts that already call it. Treat
any text after `/update-cli-command` as the command and the change wanted.

Every agent taking part in this work MUST load `about-cli-command-design` first; it holds the
principles each step below applies, and this skill does not repeat them.

Steps 1 to 4 are analysis and produce no code. Present the proposal (step 4) and wait for the
user's approval before implementing. A sub-agent may perform the survey in step 1 and the
implementation in step 5; the conversation with the user stays with the orchestrator.

## Steps

### 1. Survey Callers and Siblings

Find everything that depends on the command's current behavior:

- scripts, CI configuration, documentation, examples and tests in the repository that invoke
  it, with the exact flags they pass;
- other commands that chain it or forward flags to it;
- anything that parses its output or relies on its exit codes;
- sibling commands that declare the same flags, since a change to one flag's meaning must hold
  across all of them.

Record what the command does today, as facts, before deciding anything.

### 2. Classify the Change

Sort each part of the change into one of these:

- **Additive:** a new flag, a new accepted input, new output lines that nothing parses. Safe.
- **Behavior change behind opt-in:** new behavior that only happens when a new flag asks for
  it. Safe.
- **Default change:** the same invocation does something different. Breaking.
- **Meaning change:** an existing flag, argument or exit code now means something else.
  Breaking, and the most dangerous kind, because old invocations still parse.
- **Removal:** a flag, command or output field goes away. Breaking.

### 3. Prefer the Non-Breaking Form

- **Keep flag meanings stable.** Never give an existing flag a new meaning. If the old meaning
  is wrong, add a new flag with a new name and deprecate the old one.
- **Add opt-in behavior rather than changing defaults.** A new flag turns the new behavior on.
  Change a default only when the user decides the benefit outweighs breaking existing callers,
  and then do it through deprecation (below), never silently.
- **Renames keep the old spelling** as a hidden alias, so existing invocations keep working
  while help and docs show only the new name.
- **Unify rather than fork.** If the change reveals that this command and a sibling use
  different names for the same concept, or one name for different concepts, propose fixing
  both at once through aliases.
- **Keep machine-readable output stable.** Add fields; do not rename or remove them without
  deprecation.

For anything that must break, plan a deprecation:

1. Keep the old form working, and print a warning (to standard error) naming the old form, its
   replacement and, where the project has one, when it will be removed.
2. Update every caller found in step 1 to the new form in the same change.
3. Remove the old form only in a later, deliberately versioned release.

### 4. Present the Proposal (orchestrator, with the user)

Present the current behavior, the proposed behavior, the classification of each part, the
callers affected, and the deprecation plan for anything breaking. Wait for approval, and
revise until the user gives it.

### 5. Implement

Change the command, its aliases and any sibling that shares the affected flags. Update every
caller found in step 1. Keep the help line for each changed flag to one sentence describing
exactly what it does now.

### 6. Test

- Keep the existing tests passing unchanged wherever behavior is meant to stay the same; a test
  that must change is evidence of a breaking change, so confirm it was intended.
- Add tests for the new behavior, for each alias of a renamed flag, and for each deprecation
  warning.
- Re-check the rules the change touches: mutually exclusive and dependent flags, the dry run,
  and the non-interactive path.

### 7. Document

Update the command reference and user documentation in the same change, and record any
deprecation where the project records changes (a changelog or release notes).

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
