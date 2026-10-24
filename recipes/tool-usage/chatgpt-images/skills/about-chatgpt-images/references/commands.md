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

- `--prompt <text>` or `--prompt-file <file>` gives the set's prompt. It is required.
- `--variants-file <file>` gives each image its own prompt: a JSON array of
  `{ "prompt": "...", "note": "..." }`, one per image. Its length sets the count. The note is shown
  under the image and stored in its record, so it MUST match its prompt.
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

## state, stop

`state` lists every set and image with its status or verdict, then the open sets and how many
images are generating. `stop` stops the server and empties the trash.

## record-use, note

Both edit an archived image's record directly, with or without a server.

- `record-use --image <file> --where <path or URL> [--how <text>]`
- `note --image <file> --text <text>`
