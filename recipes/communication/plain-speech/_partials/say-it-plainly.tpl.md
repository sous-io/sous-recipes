# Say It Again, Plainly

The user did not understand what the agent said.

What was unclear: $ARGUMENTS

If nothing is named above, the whole of the agent's most recent message was unclear.

@~communication/plain-speech/_partials/speak-plainly.md

1. Load the `about-speaking-plainly` skill and read every rule in it.
2. Work out what the unclear text assumed the user already knew: an invented term, a project label,
   missing background. Say it again so every sentence can be understood without having been there.
   Keep the precise, real terms of the user's field; replace invented ones with the source's own
   name.
3. Keep every fact that mattered. Cut every word that provides no value.
4. Run the self-check in `about-speaking-plainly`. If any check fails, rewrite.
5. Send only the rewrite. Do not introduce it, list what changed, or apologize.
6. Keep speaking plainly for the rest of the session.

The rewrite MAY be longer than the original when the original skipped a definition. It is never
longer because of filler.

## Example

The agent's last message:

```text
Done. I moved the idempotency check into the ingest middleware and gated the backfill behind the
reconciler's watermark, so replays short-circuit before they hit the ledger.
```

The reply, when the user names nothing:

```text
The payment import can no longer save the same payment twice.

1. The import middleware now checks each payment's ID before saving it, and skips any payment
   that is already saved.
2. The backfill job, which re-imports old payments, used to start from the first payment ever.
   It now starts after `last_confirmed_id`, the newest payment the nightly reconcile job has
   checked.

- /home/ada/projects/ledger/src/import/middleware.ts:30
- /home/ada/projects/ledger/src/jobs/backfill.ts:12
```
