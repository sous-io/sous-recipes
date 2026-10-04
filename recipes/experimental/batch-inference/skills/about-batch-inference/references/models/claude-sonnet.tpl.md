# Claude Sonnet

> **EXPERIMENTAL.** Notes from one experiment; see `_how-to-write-model-notes.md` for what they rest on.

## claude-sonnet-5-5 (Sonnet 5.5)

- **Price** (read 2026-10-02): USD 2 per million input tokens, USD 10 per million output tokens,
  the same at Anthropic and on AWS Bedrock (Global routing). About USD 0.001 per item in this
  experiment, sending 10 to 15 items per request.
- **Final result** on all 35 decided items, 3 runs (105 answers): 77 right (73.3%), 25 unsure
  (23.8%), 3 confident mistakes (2.9%), on two different items.
- **Consistency:** 1 of 35 items changed its answer between runs.
- **Confidence works almost like a yes/no flag:** 62 to 72 whenever it sees any tension in the
  rules, 80 to 93 otherwise. Moving an item across the threshold means removing the tension it
  sees; changing how the confidence instruction is worded does little.
- **Reads definitions very literally.** One loosely worded clause in a definition held an item on
  the wrong side for several iterations until the clause was defined precisely.
- **Needs its own prompt.** A prompt shared with the other models scored 6 of 10 at worst where its
  own scored 7, mainly because the shared prompt shortened the confidence section. Sonnet relied on
  a longer one that tells it to name the parts of each item silently before answering and lists
  the kinds of objection the rules already settle.
- **Token trimming:** every cut tried (shorter wording, fewer metadata fields) lost 2 to 3 right
  answers out of 20; its prompt stayed long.
- **Too many rules hurt:** a six-step procedure pushed six items down to about 72.
