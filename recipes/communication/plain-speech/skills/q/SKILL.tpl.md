---
name: q
description: Answer the question given as the argument plainly, after loading the about-speaking-plainly skill.
argument-hint: "[question]"
disable-model-invocation: true
---

# Answer a Question Plainly

The argument is a question, and the user expects the answer to follow `about-speaking-plainly`.

1. Load the `about-speaking-plainly` skill before drafting anything, and read every rule in it.
1. Read the question: it is the argument passed to this skill.
1. Draft a short answer in plain words. Assume minimum domain knowledge unless the user's earlier
   messages show otherwise, and use the source's own identifiers rather than inventing terms.
1. Run the self-check at the end of `about-speaking-plainly` against the draft. If any check fails,
   rewrite.
1. Send only the answer. Do not restate the question or announce the rules you loaded.

This is a question, so answer it and stop; do not act on it.

## Source for this Skill

This skill comes from the `communication/plain-speech` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
