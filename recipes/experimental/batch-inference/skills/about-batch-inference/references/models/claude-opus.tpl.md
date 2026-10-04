# Claude Opus

> **EXPERIMENTAL.** Notes from one experiment; see `_how-to-write-model-notes.md` for what they rest on.

## claude-opus-5-5 (Opus 5.5)

- **Price** (read 2026-10-02): USD 4 per million input tokens, USD 20 per million output tokens,
  the same at Anthropic and on AWS Bedrock (Global routing). About USD 0.003 per item in this
  experiment, sending 10 to 15 items per request.
- **Final result** on all 35 decided items, 3 runs (105 answers): 79 right (75.2%), 23 unsure
  (21.9%), 3 confident mistakes (2.9%). All 3 mistakes were the same item, one that needed outside
  knowledge to judge.
- **Consistency:** the most stable of the four models. No item changed its answer between runs.
- **Confidence:** Opus hedges rather than errs. Its correct answers on the "no" side
  clustered at 70 to 82, right at the threshold, and every added caveat in the prompt pushed them
  a little lower. Work on removing reasons for doubt (conflicting rules, rules that seem to apply
  but do not), not on correcting its direction.
- **What helped most:** stating what it cannot know as an explicit assumption; numbered steps with
  explicit overrides; saying what each rule does not cover; defining confidence as how likely the
  person would agree.
- **Token trimming:** sending only one metadata field (the item's source title) instead of three
  cut input tokens by 12 percent with no change in score.
- **Batch API:** not available for this model on AWS Bedrock (checked 2026-10-02); the Anthropic
  API offers batch pricing.
