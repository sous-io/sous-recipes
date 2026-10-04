# Jev (TypeSafe AI)

> **EXPERIMENTAL.** Notes from one experiment; see `_how-to-write-model-notes.md` for what they rest on.

Jev is a classifier, not a writing model: it cannot generate text. A request holds a `state` (the
text or JSON to judge) and named questions, each a choice from defined options, a score on a scale,
or a yes/no (`noul`). Every answer comes with probabilities. Many questions about the same state go
in one request.

## typesafe-jev-1.13.0 (Jev 1.13)

- **Price** (read 2026-10-02): USD 0.042 per million input tokens; output is free. About USD 0.00005
  per item in this experiment, roughly 1/20th of a mid-size Claude model.
- **Access:** through DigitalOcean (its `/v1/systemone` endpoint), Vercel AI Gateway, OpenRouter or
  TypeSafe directly; not on AWS Bedrock (2026-10-02). Not OpenAI-compatible; no batch API.
- **Limits:** 64,000 tokens per request, and 32,000 for the state plus its longest question. With
  short yes/no questions, one request held about 3,000 questions (2,500 answered in 1.2 seconds;
  3,300 was refused as over the limit). Cost depends only on tokens.
- **Final result** on all 35 decided items, 3 runs (105 answers): 60 right (57.1%), 43 unsure
  (41.0%), 2 confident mistakes (1.9%), both the same item.
- **Best use: a cheap first filter.** It settles the clear items and is unsure about almost
  everything borderline. Its confidence tracks how borderline an item really is. Accept only the
  answer side where its confident mistakes are rare, and send everything else on.
- **Consistency:** near-deterministic; answers rarely change between runs.
- **What helped:**
  - task context in the state (a bare item made it treat the task like a grammar exercise);
  - asking "should this be X?" instead of asking it to count;
  - short, direct, numbered rules, with each rule marked as pushing toward yes or no;
  - examples with a one-line reason;
  - two short metadata fields (title and kind) rather than more.
- **What hurt:**
  - hypothetical tests ("imagine the parts were handled separately..."): the worst score of any version;
  - conditional instructions ("answer yes if..., no if..."): pulled probabilities toward 0.5;
  - longer prompts and more rules: each added line lowered confidence elsewhere;
  - extra context about related items: 7 right fell to 3 or 4.
- **Published weaknesses** (TypeSafe's own list): reads negations and conditions too literally, and
  leans toward the first option of a choice.
- **Benchmarks:** independent tests are mixed; one 77-category test scored it 78 percent against
  86 for a large Claude model. The vendor's calibration claims have been publicly questioned.
