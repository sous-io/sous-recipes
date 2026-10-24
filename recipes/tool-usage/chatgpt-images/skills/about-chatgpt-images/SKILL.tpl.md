---
name: about-chatgpt-images
description: >
  YOU MUST load this skill when generating, editing or choosing an image with the OpenAI Images
  API (ChatGPT's image generation), running /create-image or /create-image-spread, starting or
  stopping the image selection server, or using an image from the generated-images archive.
user-invocable: false
---

# About ChatGPT Images

This skill generates images with the OpenAI Images API (the models behind ChatGPT's image
generation) and lets the user choose among them on a local web page, the **picker**. Every image
costs the user money, so every image is archived the moment it arrives. The commands
`/create-image` and `/create-image-spread` start the flow; everything they share is here.

Terms used below:

- A **set** is one request: several images from one prompt, shown together in the picker. Sets are
  numbered from 1 in each session, and an image is labelled by set and position, such as `2.3`.
- A **spread** is a set whose every image is a numbered grid of 8 alternatives, so one image shows
  many ideas at once. Concepts inside a grid are named by grid and number, such as "2.3 #5".
- A **verdict** is what the user decides about one image: Accept (this is what the user wants),
  Store (keep it, but it is not what the user is after) or Reject (discard it).
- An image or set is **closed** when the user no longer needs to look at it. Closing NEVER implies
  what the user thinks of an image; only verdicts and comments do. A rejected or stored image closes
  at once; an accepted one closes when the picker's "Close Accepted Images" box is checked; a set
  closes itself when every image in it is closed, or when the user closes it.

> "closing an image or a set does not, in and of itself, necessarily, imply the users intent around the image. The users _other_ actions and comments provide that info. Closing something just means \"I no longer need to continue looking at this, for whatever reason\""
>
>   -- the user, in an agent session (2026-10-23)

## The Scripts

The scripts sit in this skill's `scripts/` folder (the folder this file was loaded from) and need
Node 22 or newer, with no packages to install. `scripts/imagegen.js` is the only entry point; the
examples below write it as `imagegen`, meaning `node <this skill's folder>/scripts/imagegen.js`.
Every command MUST run from the project's root, because the session (the server's state and event
log) is chosen from the working directory.

The API key comes from `OPENAI_API_KEY`, or else from the project's `.sous/.env.local`, where sous
stores the recipe's `openaiApiKey` answer. The agent MUST NOT print, log or copy the key.

The commands, in the order a session uses them:

- `imagegen serve [--fresh]` starts the server and stays running, so the agent starts it in the
  background. `--fresh` empties the picker of earlier sets; the archive is never touched. It
  refuses to start a second server for the same session.
- `imagegen watch --after <seq>` prints each event after sequence number `seq` as one JSON line,
  then keeps following. The agent runs it under a background watcher that turns each line into a
  notification (in Claude Code, the Monitor tool, with the longest timeout). When the watcher
  expires, the agent re-arms it with `--after` set to the last `seq` it saw, so no event is lost.
- `imagegen wait --event <type> [--set <n>]` blocks until a matching event arrives, prints every
  event it passed, and exits; `imagegen events --after <seq>` prints the events after `seq` and
  exits. They replace `watch` where no watcher tool exists (see "Without a Watcher").
- `imagegen add` queues a new set and returns its number. Its options are in
  [references/commands.md](references/commands.md).
- `imagegen state` lists every set and image with its status. When no server is running it exits
  with "No server has started in ...", which is how the agent tells that the picker is stopped,
  not an error.
- `imagegen stop` stops the server and discards the images waiting in the trash.
- `imagegen find <words>` searches the archive's records and prints each match's verdict, title
  and file. `imagegen crop --image <file> --cell <n> --trim` cuts one alternative out of a spread's
  grid at full resolution, for free; `--transparent` also clears its background.
- `imagegen record-use --image <file> --where <path or URL> --how <text>` records a use of an
  archived image, and `imagegen note --image <file> --text <text>` adds a note. These, `find` and
  `crop` all work without the server.

## The Flow

The orchestrator (the main session) runs every step, because each one either talks to the user or
reacts to the user's clicks.

1. **Look in the archive first** with `imagegen find`, using a few words from the request. If a
   stored image already fits, offer it before generating anything.
2. **Draft the prompt.** Keep it loose: a prompt that specifies every detail makes every image in a
   set nearly identical. Carry over style choices the user settled earlier in the conversation.
3. **Offer reference images.** Up to 4 images can be attached as references (a logo to match, a
   product photo, an earlier pick). If the agent knows of images that would help, it offers them in
   the proposal; it never attaches one the user has not agreed to.
4. **Propose.** Present the choices as "Option 1", "Option 2" and so on, always ending with
   "Something else...". The agent's own prompt is marked "(with minor variations)". Another option
   is the user's own wording, polished only for grammar, keeping its spirit. State the number of
   images (3 unless the user asked for another number) and the size.
5. **Write the variants.** If the user chose the agent's prompt, each image gets a slightly varied
   version of it (a different angle, setting, palette or emphasis) and a short note saying how it
   differs. Every note MUST describe exactly what its prompt asks for. If the user chose their own
   wording, every image uses it unchanged.
6. **Start the picker** if it is not running (`imagegen state` fails when it is not): run `serve`
   in the background (with `--fresh` at the start of a new request), start the watcher, and give the
   user the address it prints. When the agent can drive a browser (such as through a browser
   automation tool), it also opens the address in a new tab. The page updates live, so later sets
   need no new address.
7. **Add the set** with `imagegen add`, including `--request` (the user's words) and `--purpose`
   (why the image is wanted), so the archive records both.
8. **React to events** as [references/events.md](references/events.md) describes. The agent looks
   at each image as it arrives and tells the user anything notable, briefly.
9. **Stop** when an event carries `canStop: true` (every set closed, nothing generating, and "Keep
   Alive" unchecked) and the user has not asked to keep the picker. A stopped picker is restarted
   with `serve`, without `--fresh`, whenever the user wants it back.
10. **Use the accepted images** for the goal the user has described or soon will, and record every
    use with `record-use`. Stored images are kept for later and are not used now. An accepted
    image whose comment says it is not for the current work is kept, not used. When the user picks
    one alternative out of a spread's grid for use as it is, `crop` cuts it out rather than paying
    for a new generation; an edit request is only for changing it.

## Without a Watcher

Where no tool turns a running command's output into notifications, the agent tracks the last `seq`
it has read and works this way instead:

- After adding a set, it runs `imagegen wait --set <n> --event set-generated` in the background,
  and tells the user about the images once that command finishes.
- While the user reviews, it keeps one `imagegen wait --event any-user` running in the background,
  and starts another each time one finishes, so each click still reaches the agent.
- Whenever the user writes, it first reads `imagegen events --after <seq>`, so nothing done in the
  picker in the meantime is missed.

`--event` takes one or more event types, separated by commas, or a group: `any-verdict` (the
verdicts and their undoing), `any-user` (everything the user can do in the picker) or `any`.

Example of a proposal:

```text
**Option 1: Use my prompt (with minor variations)**
A watercolour illustration of a lighthouse on a rocky coast at dawn, with soft light and gulls.

**Option 2: Use your wording, lightly polished**
A lighthouse at dawn, in watercolour.

**Option 3: Change my prompt** (tell me what to change)

**Option 4: Something else...**

I'll generate 3 copies at 1024x1024 unless you want a different number. I can also attach the
lighthouse photo you shared earlier as a reference.
```

## The Archive

Every image is written to `<sous home>/generated-images/<date>/` the moment it is generated, beside
a markdown record of the same name; the sous home is `SOUS_HOME`, or `~/.sous`. A rejected image
waits in the session's trash, so the user can undo, and is deleted when its set closes or the
server stops. An image left without a verdict stays archived as `undecided`. The record's fields are
in [references/archive.md](references/archive.md).

## Reference Files

- [commands.md](references/commands.md): every command and option of `imagegen.js`
- [events.md](references/events.md): every event the picker sends, and what the agent does about each
- [archive.md](references/archive.md): the archive layout and the record's frontmatter

## Source for this Skill

This skill comes from the `tool-usage/chatgpt-images` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
