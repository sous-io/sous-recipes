# Claude Fable

> **EXPERIMENTAL.** Notes from one experiment; see `_how-to-write-model-notes.md` for what they rest on.

## claude-fable-5-1 (Fable 5.1)

- **Price:** not recorded in this experiment. It writes about 950 tokens of internal reasoning per
  request on top of its answer (about 1,400 output tokens per request of 10 to 15 items), so count
  output cost carefully. One provider survey (2026-10-02) found prompts sent to it kept for 30
  days, unlike the other Claude models there.
- **Final result** on all 35 decided items, 3 runs (105 answers): 87 right (82.9%, the most of the
  four), 13 unsure (12.4%), 5 confident mistakes (4.8%, also the most).
- **Consistency:** answers almost never changed between runs (2 of 35 items); only the confidence
  moved, by about 5 points.
- **Confidence:** sits in a narrow band of 65 to 80 on borderline items, and wording changes moved
  it much less than they moved its answer. The approach that lifted it honestly was defining
  confidence as a frequency ("at 75, expect the person to disagree about once in four").
- **Overconfident on missing knowledge.** Its repeated confident mistake was an item whose answer
  depended on a fact about a tool that the item did not state. Narrow notes about what the model
  cannot know helped; a broad note lowered confidence on items that were clear.
- **What helped:** giving it the person's method as ordered steps rather than a checklist; saying
  which rule wins when two apply; saying which way the person leans on close cases.
- **Token trimming:** every cut tried lost answers; its prompt stayed long.
