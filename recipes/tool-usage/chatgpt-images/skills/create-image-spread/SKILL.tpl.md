---
name: create-image-spread
description: Generate grids of 8 numbered alternatives with ChatGPT's image models, to explore many ideas at once in a local picker.
argument-hint: "[what the alternatives should show]"
disable-model-invocation: true
---

# Create an Image Spread

What the alternatives should show: $ARGUMENTS

If nothing is described above, take the image the conversation of roughly the last 10 turns most
plainly calls for, and name it in the first line of the reply.

The agent performing this command MUST load `about-chatgpt-images` first and follow its flow. A
spread asks for one image that holds 8 numbered alternatives in a grid, and still sends several
such requests (3 unless the user asked for another number), so the user sees many ideas at once.
What differs from a single image:

- **The prompt asks for the grid.** It opens "A single image showing 8 distinct" alternatives of the
  subject, "arranged in a clean grid of 4 columns and 2 rows on a plain background", with "a small
  number from 1 to 8 beneath" each one. Constraints the user gave (no lettering, a palette) apply
  to every alternative. When the user rules out text, the prompt says "the numbers are the only
  text in the image", because the required numbers otherwise pull against the constraint.
- **The base prompt names no example ideas.** Ideas listed in the base prompt reappear in every
  grid. Instead, each image's variant gives that grid its own starting directions or palette, and
  its note says so.
- **The set is a spread.** Add it with `--mode spread` and `--size 1536x1024`, the shape of a 4 by
  2 grid.
- **Concepts are named by grid and number.** Tell the user that a comment such as "3.2 #5" picks out
  one alternative. To use an alternative as it is, cut it out with
  `imagegen crop --image <grid> --cell <n> --trim`, which costs nothing. An edit request on one
  alternative becomes an ordinary set, square unless the user said otherwise, asking for that
  alternative alone, with the grid (or the cropped alternative) attached as its reference.

Example of the first reply:

```text
**Option 1: Use my prompt (with minor variations)**
A single image showing 8 distinct icon concepts for a recipe-sharing app, arranged in a clean grid
of 4 columns and 2 rows on a plain white background, each with a small number from 1 to 8 beneath
it. Flat vector style, simple shapes, legible at small sizes.

**Option 2: Use your wording, lightly polished**
An image showing 8 numbered icon ideas for a recipe-sharing app.

**Option 3: Change my prompt** (tell me what to change)

**Option 4: Something else...**

I'll generate 3 grids at 1536x1024, which gives you 24 concepts, unless you want a different
number.
```

## Source for this Skill

This skill comes from the `tool-usage/chatgpt-images` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
