# Reading and the Network

## Read-Only Commands Are Offline and Fast by Default

A command whose purpose is to show information (`list`, `show`, `status`, `search`) should:

- change nothing, ever;
- answer from local data (a cache, a lockfile, the working tree) by default;
- return quickly enough that people run it without thinking.

Reading the remote is an explicit choice, made with a flag such as `--remote` or `--refresh`.
When local data may be stale, the output can say how old it is ("index last fetched 3 days
ago"), which is a fact the reader can act on.

If something the command would normally show has never been fetched, name it rather than
silently leaving it out:

```
The index for "widgets" has never been fetched, so its recipes are not listed.
```

## Source Versus Selection

Two independent questions deserve two independent flags:

- **Where does the data come from?** Local data, or the remote (`--remote`).
- **Which items are shown?** The default subset, everything (`--all`), or a filter
  (`--status open`).

Combining them (a single `--all` that both fetches remotely and shows hidden items) forces the
user to pay for a network call just to see hidden local items, or the reverse.

## Network Steps

**Short timeouts.** A few seconds is usually right for a check the command can do without. A
long hang is worse than a skipped check, because the user cannot tell whether anything is
happening.

**Best effort where the command can still succeed.** A build that checks for newer versions
should still build when the check fails, using the last good answer, and say so:

```
Warning: could not check registry.example.com for newer versions of 2 packages.
    Reason:  connection refused (from the HTTP client)
    Using:   the versions already recorded in the lockfile
```

**Say exactly what could not be checked, and why.** Name the host, the items affected and the
underlying tool's own reason. Do not substitute a guess: "you appear to be offline" may be
wrong (the host may be down, a proxy may be blocking it, a token may have expired), and a wrong
guess sends the user to fix the wrong thing.

**Fail only when the network step is the point.** `mytool fetch`, `mytool publish` and
`mytool search --remote` exist to talk to the network, so a network failure fails them. A
command that merely consults the network on the way to doing something local does not fail.

## Credentials

Prefer credentials the user already has: an environment variable, or the signed-in session of
the host's own CLI. When none is available and the resource is public, try without one. When a
request fails for lack of credentials, say which credential sources were tried.
