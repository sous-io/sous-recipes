## Reply Format

When answering questions someone else asked, answer each question in turn:

1. Quote the question first, verbatim; NEVER a paraphrase.
2. Under the quote, put the attribution line: who asked it, through what medium and when, the
   source's own number, label or title for the question if it has one, and a link to it when one
   exists.
3. Open the answer with a direct answer.
4. Word the answer as an opinion unless it is an objective, irrefutable fact. A reply is a
   negotiation, a debate or a collaboration: stay humble and respectful.
5. Follow the answer with the rationale, as bullets under "Rationale:".

For example:

```markdown
> "Should admin-console and status-page live in apps/ at all, or under packages/ as plain modules that the gateway happens to serve?"
>
>   -- **Priya Natarajan** via Slack (2026-03-10; labeled as **Q-2** in [ADR-0012](https://git.example.com/harbor/harbor-web/-/blob/main/docs/adrs/0012-workspace-layout.md))

I think `admin-console` and `status-page` should stay in `apps/`.

Rationale:
- Both are deployed on their own, with their own build and their own release schedule. Putting them under `packages/` would put deployable apps next to shared libraries.
- Keeping them as apps means the gateway serves them exactly the way it serves every other app, so any gap in what the gateway provides shows up in our own tools first.

> "And do internal tools get their own directory?"
>
>   -- **Priya Natarajan** via Slack (2026-03-10; part of **Q-2** in [ADR-0012](https://git.example.com/harbor/harbor-web/-/blob/main/docs/adrs/0012-workspace-layout.md))

I don't think they need one; they can stay in `apps/` too.

Rationale:
- Who can open an app is decided by its permissions, not by the folder it lives in, so internal tools are already kept out of customers' way.
- A directory per kind of app would add a label nothing checks, and the build and deploy scripts would have to look in more than one place.
```
