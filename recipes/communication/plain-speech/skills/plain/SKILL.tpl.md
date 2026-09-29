---
name: plain
description: Rewrite the previous response plainly, after loading the about-speaking-plainly skill.
disable-model-invocation: true
---

# Rewrite the Previous Response Plainly

The user has flagged the previous response as full of jargon, too long, or unclear. Rewrite it.

1. Load the `about-speaking-plainly` skill before doing anything else, and read every rule in it.
1. Take the most recent assistant message in the conversation; that is the response to rewrite.
1. Rewrite it under every rule in `about-speaking-plainly`: cut jargon, filler, piles of adjectives,
   closing "in practice" sentences and caveat footers, and shorten.
1. Run the self-check at the end of `about-speaking-plainly` against the rewrite. If any check fails,
   rewrite again.
1. Send only the rewritten version. Do not introduce it, list the changes, or apologize.

Plain means simpler words, not more words, so the rewrite is almost always shorter than the original.
Drop file paths, caveats and sections nobody asked for, and replace every invented term with the
source's own identifier or with arithmetic.

## Source for this Skill

This skill comes from the `communication/plain-speech` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
