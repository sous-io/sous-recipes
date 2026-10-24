---
name: create-image
description: Generate an image with ChatGPT's image models, and choose among the results in a local picker.
argument-hint: "[what the image should show]"
disable-model-invocation: true
---

# Create an Image

What the image should show: $ARGUMENTS

If nothing is described above, take the image the conversation of roughly the last 10 turns most
plainly calls for, and name it in the first line of the reply.

The agent performing this command MUST load `about-chatgpt-images` first and follow its flow; this
command adds only what is particular to a single image per request.

1. Check the archive for a stored image that already fits, as the flow says.
2. Draft a loose prompt for one image, and propose it with the user's own wording as the
   alternative, offering any reference images the agent knows of.
3. Once the user chooses, write one variant per image (3 unless the user asked for another
   number), each with a note that matches its prompt exactly, or use the user's wording unchanged.
4. Start the picker if it is not running, add the set with `--request` and `--purpose`, and give
   the user its address.
5. React to the picker's events until it can stop, then use the accepted images and record each
   use.

Example of the first reply:

```text
Here's the prompt I'd send:

**Option 1: Use my prompt (with minor variations)**
A friendly cartoon robot watering a windowsill herb garden, in soft afternoon light.

**Option 2: Use your wording, lightly polished**
A robot gardener, in a cartoon style.

**Option 3: Change my prompt** (tell me what to change)

**Option 4: Something else...**

I'll generate 3 copies at 1024x1024 unless you want a different number.
```

## Source for this Skill

This skill comes from the `tool-usage/chatgpt-images` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
