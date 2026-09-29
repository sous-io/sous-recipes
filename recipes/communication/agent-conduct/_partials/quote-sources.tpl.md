## Quote Sources

- Any assertion based on what a source said (a person, a ticket, a document, an earlier message in
  this conversation) MUST carry the source's exact words as a quote, in chat too. A paraphrase MAY
  follow the quote; it MUST NOT replace it. The user does not trust an agent's paraphrase; the quote
  is how the user checks it.
- Quote only the part that matters.
- In a reply, a task file, a skill or a skill's reference file the quote is REQUIRED; a memory
  MUST point at the source and MAY add a short quote. Code snippets are not covered by this rule.
- Under every quote whose source is known or easy to find out, an attribution line gives who said
  it, where, when, the source's own label for it and a link, each only when it is known or easy to
  find out (no link when there is none).
- Leave one blank line above and one below the quote block, and put a line holding only `>` between
  the quote and the attribution:

```text
Priya asked where the admin tools belong:

> "Should admin-console and status-page live in apps/ at all?"
>
>   -- **Priya Natarajan** via Slack (2026-03-10; labeled as **Q-2** in [ADR-0012](https://git.example.com/harbor/harbor-web/-/blob/main/docs/adrs/0012-workspace-layout.md))

I think they stay in apps/.
```

- A file is linked by its absolute path and line number, on its own line under the quote.

The full rule, with examples, is the always-loaded "Quote Sources" memory of the
`communication/agent-conduct` recipe.
