# Picker Events

`imagegen watch` prints one JSON object per line. Every event has `seq` (its sequence number),
`event` (its type) and `at` (when it happened). An event about one image also has `label` (such as
`2.3`), `set`, `image`, `title`, `note` (the image's variation), `verdict`, `file` (the image) and
`record` (its markdown record). An event the user caused with text also has `text`.

## What the Agent Does About Each

The events below are listed by type, each with what it means and what the agent does.

- `server-started`, `server-stopped`: the server came up or went down. Nothing to do, unless the
  server stopped without the agent asking it to.
- `set-added`: a set was queued. Nothing to do.
- `image-ready`: an image arrived. The agent looks at it (it can read the `file`) and tells the user
  anything notable, such as a flaw the user may miss, in a sentence or two.
- `image-failed`: the image failed, with the reason in `error`. The user can press Retry; the agent
  mentions a failure only when it needs a change (a refused prompt, a bad key).
- `set-generated`: every image in a set has finished.
- `accept`, `store`, `reject`: the user gave a verdict. `unaccept`, `unstore` and `unreject` take
  one back. When `text` is present, the user typed it before clicking, and the agent MUST weigh it
  with the verdict: an image accepted with "good, but not for this" is approved and NOT used now.
- `comment`: a comment on one image. It sets no verdict. The agent answers it, or acts on it if it
  asks for something.
- `edit-request`: a comment sent with "Request edit" checked (or a verdict whose `text` carries
  `editRequest: true`). The agent phrases the comment as an edit to the attached image and adds a
  new set straight away, without asking, with `--ref <file> --edit-of <label>`. `prompt` holds the
  image's prompt. When the comment picks one concept out of a spread grid, the new set is an
  ordinary set, square unless the user said otherwise, asking for that concept alone.
- `retry`: the user retried a failed image; the server regenerates it.
- `refresh`: the user regenerated a whole set; the server added it as `newSet`, with the same
  prompts.
- `close-set`: the user closed a set, or it closed itself (`auto: true`). It lists the set's
  `accepted`, `stored`, `rejected`, `undecided` and `failed` images. It is NOT a verdict.
- `reopen-set`: the user reopened a closed set.
- `keep-alive`: the user checked or unchecked "Keep Alive".

`close-set` and `keep-alive` also carry `openSets`, `generating`, `allClosed`, `keepAlive` and
`canStop`. The agent stops the server when `canStop` is true, unless the user has asked it not to.

Example of an event, and the agent's reply:

```text
{"seq":31,"event":"edit-request","label":"3.1","set":3,"image":1,"text":"I like #8, show it larger in green","file":"/home/ada/.sous/generated-images/2026-03-02/101500-app-icon-concepts-3.1.png", ...}

That's an edit request on 3.1. I'm adding concept #8 alone, larger and in green, as Set 4, with
3.1 attached as the reference.
```
