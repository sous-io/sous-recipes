# Output and Errors

## Output States Facts

Output tells the reader what happened, in words a newcomer understands without a legend.

Before:
```
[OK] 3/4 synced (1 skip: E_STALE)
```

After:
```
Synced 3 of 4 environments.
Skipped "staging", because its lockfile is older than the configuration it was built from.
```

Rules:

- Complete sentences, or a labeled key and value list with one short sentence after it.
- No abbreviations the reader has to decode, no private status codes, no compressed notation.
- Prefer a list over a paragraph when there are several facts; do not bury facts in prose.
- Align labeled values so they are easy to scan, and use one way of doing it across the tool.
- Color supports meaning but never carries it alone; the output must read correctly with color
  off.

## No Footer Hints

A command's output ends with what happened. It does not end with "Run `mytool deploy` next" or
"Tip: try `--verbose`". Such footers go stale, train people to skim, and blur the line between
facts and advice. The rare exception is deliberate: an error whose only fix is one specific
command may name that command, because the reader needs it right now.

## Warnings Versus Errors

- **Error:** the command cannot do what was asked, or doing it would require a guess the user
  must make. It exits non-zero.
- **Warning:** the command did what was asked, but something the user may want to know about
  happened along the way (a reading of ambiguous intent, a skipped best-effort check, a
  deprecated flag). It exits zero.
- **Note:** an explanation that is neither, such as why a default was chosen.

A warning that the user can do nothing about, or that repeats on every run, is noise; either
make it actionable or drop it.

## Error Format

- Prefix every error with a literal word such as `Error: ` so it is findable with color off,
  in logs, and by `grep`.
- Say what was attempted, what went wrong, and (when known) what would fix it.
- Name the exact input at fault: the flag, the file and line, the item.
- Expected failures (bad input, a missing file, a refused confirmation) print the message and
  nothing else. Stack traces are for unexpected failures, and only when a debug switch asks for
  them.
- Usage errors may print the command's own help beneath the message.
- Errors, warnings and prompts go to standard error; standard output carries only the result,
  so `mytool list | other-tool` keeps working when something goes wrong.

## Failure Midway

When a multi-step command fails partway, the reader needs to know what state they are in:

```
Error: pushing tag v1.4.0 failed: the remote rejected it (tag already exists).

Completed before the failure:
  - Raised the version to 1.4.0
  - Committed the release
  - Created tag v1.4.0 locally

Not done:
  - Push the commit and the tag
```

Print each step as it starts, so even an interrupted run leaves a trail.

## Facts Versus Judgments

Anything the tool reports (a lint, a review, a status check, an audit) keeps two things apart:

- **Facts:** what was observed. "The function returns before closing the file on line 42."
- **Judgments:** whether that is a problem. "This leaks a file handle; the project rule is that
  every opened file is closed on every path."

Label judgments as judgments and name the rule each one applies. Never call something a bug, a
violation, unsafe or wrong without stating the rule it breaks; without the rule, the reader
cannot tell whether the tool is right or merely opinionated.

## Help Text

Help describes exactly the thing it names, in one sentence:

```
mytool prune    Remove output files that no current target produces.
  --dry-run     Print the files that would be removed and remove nothing.
```

No "see also", no tips, no pointers to other commands, no history of the flag.
