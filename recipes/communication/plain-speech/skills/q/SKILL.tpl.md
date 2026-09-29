---
name: q
description: Answer a question plainly, without acting on it.
argument-hint: "[question]"
disable-model-invocation: true
---

# Answer a Question Plainly

The user has a question and expects a plain answer.

Question: $ARGUMENTS

If nothing is named above, answer every question the user asked in roughly the last 10 turns that
still has no plain answer, and name them in the first line of the reply.

@~communication/plain-speech/_partials/speak-plainly.md

1. Load the `about-speaking-plainly` skill and read every rule in it.
2. Answer with only what the user needs now. Assume the user knows the standard terms of their
   field, but not the background of this project or this conversation. Use the source's own names;
   never invent a term.
3. Run the self-check in `about-speaking-plainly`. If any check fails, rewrite.
4. Send only the answer. Do not restate the question or announce which rules were loaded.

This is a question, so answer it and stop; do not act on it.

## Example

After `/q what does max_connections do?`:

```text
`max_connections` (`integer = 20`) is the most requests that may use the database at the same
time. When 20 are already using it, the next request waits until one of them finishes.

- /home/ada/projects/widget-api/config/database.yaml:7
```

## Source for this Skill

This skill comes from the `communication/plain-speech` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
