# The Image Archive

Every generated image is kept, because every one cost money. The archive lives at
`<sous home>/generated-images`, where the sous home is `SOUS_HOME` or `~/.sous`:

- `<date>/<time>-<title>-<set>.<image>.<ext>` is the image. The date and time are when its set was
  created; a retried image adds `-r<attempt>`.
- `<date>/<same name>.md` is its record.
- `.sessions/<project>-<hash>/` holds one project's server state, event log and trash. Nothing in it
  is archived.

## The Record

The record's frontmatter holds the metadata, one field per line, each value written as one line of
JSON (which is valid YAML). The body is written from the frontmatter, under the headings "Why It
Was Generated", "Prompt", "Feedback" and "Where It Was Used". The scripts rewrite the whole record
whenever a field changes, so a change MUST go through `record-use` or `note`, never a hand edit.

The fields, in order:

- `id`, `image`: the record's path inside the archive, without its extension, and the image's file
  name.
- `status`: `undecided`, `accepted`, `stored` or `rejected`.
- `title`, `createdAt`, `updatedAt`.
- `request`, `purpose`, `project`: the user's words, why the image was wanted, and the project it
  was made for.
- `prompt`, `basePrompt`, `variation`, `revisedPrompt`: the prompt sent, the set's prompt when the
  image had a variant, the variant's note, and the model's own revision of the prompt, when it
  returned one.
- `mode`, `model`, `size`, `quality`, `referenceImages`.
- `generationSeconds`, `usage`: how long it took, and the token usage the API reported.
- `session`, `set`, `index`, `attempt`, `refreshOf`, `editOf`: where it came from in the picker.
- `comments`: each `{ text, at }`, with `editRequest: true` for an edit request and `with` naming
  the verdict it was sent with.
- `usedIn`: each `{ where, how, at }`, written by `record-use`.
- `notes`: each `{ text, at }`, written by `note`.

Example of a record's frontmatter:

```text
---
id: "2026-03-02/101500-lighthouse-at-dawn-1.2"
image: "101500-lighthouse-at-dawn-1.2.png"
status: "accepted"
title: "Lighthouse at dawn"
createdAt: "2026-03-02T10:15:22.104Z"
updatedAt: "2026-03-02T10:31:05.950Z"
request: "a lighthouse at dawn, in watercolour"
purpose: "Cover image for the coastal walks guide."
prompt: "A watercolour illustration of a lighthouse on a rocky coast at dawn, seen from the beach."
variation: "seen from the beach"
model: "gpt-image-2"
size: "1024x1024"
comments: [{"text":"love the gulls","at":"2026-03-02T10:20:41.003Z"}]
usedIn: [{"where":"guides/coastal-walks/cover.md","how":"cover image","at":"2026-03-02T10:31:05.950Z"}]
---
```
