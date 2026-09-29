# Quote Sources

Whenever the agent makes an assertion based on what a source said, it MUST include the source's
exact words as a quote. This applies everywhere the agent writes: chat replies, task notes, issues,
pull requests and documents. A source is anything that said something: a person, a ticket, a chat
message, a review comment, a document, a decision record, or an earlier message in this
conversation.

This is not optional polish. The user does not trust an agent's paraphrase: it is usually right, but
wrong often enough that the user has to check every one against the source. A verbatim quote lets
the user check it on the spot. It also saves the reader a trip: the user does not have every source
memorized, should not have to read a whole document for one line, and a person the user replies to
should never have to remember or look up what they said.

## The Rules

1. Quote the source's exact words. A paraphrase or an interpretation MAY follow the quote; it MUST
   NOT replace it.
2. Quote only the part that matters. The quote saves the reader a trip to the source; it does not
   reproduce the source.
3. Put an attribution line under every quote whose source is known or easy to find out. It holds,
   best effort, each part that is known or easy to find out: who said it (or which document), where
   (the medium or the section), when, the source's own number, label or title for it, and a link.
   Leave out every other part; NEVER guess one. A source with no link gets no link.
4. Link when a link exists: a URL for anything on the web, inside the attribution line; for a file,
   its absolute path with a line number, on its own line as a list item under the quote.
5. Words from earlier in this conversation count too: quote or restate them where they are referred
   to, never only point at them ("your last question", "the option above").
6. Leave one blank line above and one below every quote block, and put a line holding only `>`
   between the quote and its attribution line.

The format, with every part of the attribution known:

```text
Priya asked where the admin tools belong:

> "Should admin-console and status-page live in apps/ at all?"
>
>   -- **Priya Natarajan** via Slack (2026-03-10; labeled as **Q-2** in [ADR-0012](https://git.example.com/harbor/harbor-web/-/blob/main/docs/adrs/0012-workspace-layout.md))

I think they stay in apps/.
```

## Examples

An assertion in chat, quoting a file:

```text
The stale image cannot be left over from the previous release. The deploy guide says:

> "Every release clears the CDN cache for the whole site."
>
>   -- harbor-web deploy guide, section "Releasing"

- /home/dev/harbor-web/docs/deploy.md:58
```

A person quoted in a task note, followed by the agent's interpretation:

```text
Priya asked for the export to stay a CSV file:

> "Please keep it CSV; finance opens it straight in their spreadsheet tool."
>
>   -- **Priya Natarajan** in a comment on HARBOR-418, "Monthly usage export" (2026-03-12, [link](https://tracker.example.com/browse/HARBOR-418))

I read that as ruling out the JSON option, not only as a preference.
```
