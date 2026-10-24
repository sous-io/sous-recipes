# The imagegen Commands

`scripts/imagegen.js` is run with Node 22 or newer from the project's root. Every option that takes
a value is written `--name value`; a flag is written `--name` alone.

## Options Every Command Takes

- `--session <dir>` overrides the session folder. By default it is one folder per working
  directory, under `<archive>/.sessions/`, so every command from the same project finds the same
  server. `IMAGEGEN_SESSION` sets it too.
- `--archive <dir>` overrides the archive, `<sous home>/generated-images` by default.

## serve

Starts the server; it runs until `stop`. Its first lines name the picker's address, the session
and the archive.

- `--fresh` starts with an empty picker.
- `--port <n>` is the port to try first (7766); a busy port falls back to any free one.
- `--model <id>` is the default model (`gpt-image-2`). `--size <WxH>` is the default size
  (`1024x1024`; the models also take `1536x1024`, `1024x1536` and `auto`). `--quality` is the
  default quality (`auto`, or `low`, `medium`, `high`). `--count <n>` is the default number of
  images in a set (3).
- `--concurrency <n>` is how many images generate at once (4).

`OPENAI_BASE_URL` points the scripts at another endpoint, which is useful only for testing.

## add

Queues a set and prints `{"set":N,"count":N}`.

- `--prompt <text>` or `--prompt-file <file>` gives the set's prompt. Without variants it is the
  prompt every image is sent with, and required.
- `--variants-file <file>` gives each image its own prompt: a JSON array of
  `{ "prompt": "...", "note": "..." }`, one per image. Its length sets the count. The note is shown
  under the image and stored in its record, so it MUST match its prompt. With variants, `--prompt`
  is optional: it is never sent, but heads the set in the picker and is recorded as each image's
  base prompt; without it the first variant's prompt stands in.
- `--count <n>` sets the number of images when there are no variants (1 to 16).
- `--title <text>` is the set's heading in the picker, and names its files.
- `--request <text>` is the user's own words; `--purpose <text>` is why the image is wanted.
- `--ref <image>` attaches a reference image (PNG, JPEG or WebP); repeat it, up to 4 times. A set
  with references is sent to the API's edits endpoint.
- `--edit-of <label>` marks the set as an edit of an image, such as `3.1`.
- `--mode spread` marks a spread; `--size`, `--model` and `--quality` override the defaults.
- `--project <dir>` records the project the image was made for (the working directory by default).

Example of a set with variants and a reference:

```bash
node <skill>/scripts/imagegen.js add \
  --prompt "A watercolour illustration of a lighthouse on a rocky coast at dawn." \
  --variants-file /tmp/lighthouse-variants.json \
  --ref docs/photos/lighthouse.jpg \
  --title "Lighthouse at dawn" \
  --request "a lighthouse at dawn, in watercolour" \
  --purpose "Cover image for the coastal walks guide."
```

## watch

`--after <seq>` prints every event after that sequence number (0 by default), then follows the log
every quarter of a second. It never exits on its own.

## events, wait

`events --after <seq>` prints every event after that sequence number and exits.

`wait` blocks until a matching event arrives, printing every event it passes, then exits with 0. It
exits with 2 if `--timeout <seconds>` passes first.

- `--after <seq>` starts after that event; by default `wait` waits for events newer than the last
  one already logged.
- `--event <types>` is a comma-separated list of event types, or a group: `any-verdict`, `any-user`
  or `any` (the default).
- `--set <n>` matches only events about that set (including a `refresh` that created it).

## state, stop

`state` lists every set and image with its status or verdict, then the open sets and how many
images are generating. With no server running, it exits with 1 and prints "No server has started
in ..."; that is how the agent tells the picker is stopped, and it is not an error. `stop` stops
the server and empties the trash.

## find

`find <word>...` prints every archived image whose title, request, purpose, prompt, variation or
comments contain all the words, newest first, with its verdict, title, date folder and file.
`--status <status>` keeps only `accepted`, `stored` or `undecided` images.

## crop

`crop --image <file> --cell <n>` cuts cell `n` (counted from 1, left to right, then top to bottom)
out of a grid image at full resolution, and prints the new file's path. It reads PNG files only,
which is what the API returns.

- `--grid <columns>x<rows>` is the grid's shape (`4x2`).
- `--trim` keeps only the alternative itself: the model draws its own margins, so a cell divided
  evenly rarely lines up, and trimming drops the number beneath and the empty space around it.
- `--transparent` makes the background that touches the edges transparent; enclosed areas stay
  opaque. `--tolerance <n>` is how far a colour may be from the background's and still count as
  background (24, out of 255).
- `--out <file>` is where to write it; by default it is beside the image, named `-cell<n>.png`.

## record-use, note

Both edit an archived image's record directly, with or without a server.

- `record-use --image <file> --where <path or URL> [--how <text>]`
- `note --image <file> --text <text>`
