# Flag Design

Flags are the vocabulary of a tool. Users learn them once and expect them to mean the same
thing everywhere, so a flag is a promise that outlives the command that introduced it.

## Survey Before Naming

Before adding a flag, list the flags every existing command already declares and what each
means. For each new option, ask in order:

1. **Does a flag with this meaning already exist?** Reuse its exact name, short form and value
   grammar.
2. **Does a flag with this name exist with a different meaning?** Choose another name. Two
   meanings for one name is the worst outcome, because a user's correct habit becomes wrong.
3. **Does a flag with a close but slightly different meaning exist?** Decide whether the
   concepts are truly the same. If they are, reuse the name and, if needed, tweak the existing
   flag so one definition serves both. If they are not, pick a name that makes the difference
   visible.

When a survey finds an existing flag whose name no longer fits the concept it has grown into,
propose renaming it (keeping the old name as a hidden alias) rather than inventing a second
name for the same thing.

## Same Concept, Same Name

```
mytool build   --dry-run      # prints the plan, changes nothing
mytool deploy  --dry-run      # same meaning, same name
mytool deploy  --preview      # wrong: a second name for the same concept
```

## Different Concepts, Different Names

Words that feel close often name different operations. Keep them apart:

| Concept | Example flag | What it does |
|---|---|---|
| Read the latest upstream state before acting | `--refresh` | reads; changes nothing locally beyond a cache |
| Move to newer released versions | `--upgrade` | changes what is installed or pinned |
| Include items normally hidden | `--all` | changes the selection shown |
| Read from the remote instead of local data | `--remote` | changes the source |

Using one flag for two of these (for example `--update` meaning both "refresh" and "upgrade")
forces users to guess which one a given command means.

## A Flag Requires a Value, or It Is a Boolean

Optional-value flags are ambiguous: in `mytool start --branch feature`, is `feature` the
branch name or a positional argument? Parsers differ, users cannot tell, and adding a
positional argument later silently changes the meaning of existing invocations.

Split the two behaviors instead:

```
mytool start --create-branch feature-login    # a value: this exact name
mytool start --generate-branch                # a boolean: make up a name
```

The two are then mutually exclusive (see below).

## Mutually Exclusive Flags

When two flags ask for contradictory things, passing both is an error, never a silent
precedence rule:

```
Error: --create-branch and --generate-branch cannot be used together; the first names the
branch and the second asks for a generated name.
```

Declare the exclusion in the parser where it supports one, so help can show it too.

## Dependent Flags

A flag that only means something alongside another depends on it. Passing it alone is an
error naming the flag it needs, not a silent no-op:

```
Error: --push-tags only applies together with --tag.
```

## Booleans and Negation

- A boolean that defaults to on needs a negated form (`--no-build`) so it can be switched off.
- Name booleans for the behavior they enable, so the default reads naturally: `--no-prune`
  rather than `--prune=false`.
- Never make a boolean flip meaning between commands.

## The Confirmation Flag

One flag answers "yes" to every confirmation the tool asks, and it is the same flag in every
command (conventionally `--yes` with `-y`). If historical commands use `--force` for this,
keep `--force` as an alias of the one flag rather than a second, separate flag. Where
`--force` means something else in one command (for example "overwrite existing files"), that
is a different concept and deserves a clearer name there (`--overwrite`).

## Short Forms and Aliases

- Documented names are full words: `--namespace`, not `--ns`.
- Abbreviations may exist as hidden aliases, so people who already type them are not broken.
- Short single-letter forms are scarce; reserve them for the flags used most, and never give
  one letter two meanings across commands.
- When an alias exists, help lists the flag once, with the alias noted beside it, never as two
  entries.

## Pass-Through Flags on Chaining Commands

A command that runs other commands accepts their flags and forwards them. Rules:

- Forward the flag with the same name and grammar it has on the inner command.
- Rename only when the combined command would otherwise be ambiguous, and prefix the renamed
  flag with the inner command's name (`--build-target`).
- Validate forwarded flags before the first step runs, so a bad value fails fast instead of
  after half the chain has executed.
- If the tool wraps an external program, a bare `--` conventionally forwards everything after
  it verbatim.

## Environment Variables

An environment variable that sets a flag's value is lower priority than the flag itself. Treat
an empty or whitespace-only value as unset. Name errors after the source the user actually
set (the flag or the variable), not always the flag.
