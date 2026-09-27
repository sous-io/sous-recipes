# The Sweep Brief

The full sweep is delegated, and a sub-agent cannot see the conversation, so every sweep gets
the same brief. Fill in the bracketed parts; keep the rest as written.

## The Prompt

```text
You are running the READ-ONLY full sweep for a goal in {{ githubRepo }}. First load the
`about-goals` and `about-github-projects` skills. Do not create, edit, label, comment on or
close anything.

## The goal (draft)
[The goal statement, verbatim.]
### Coverage
[Each coverage item, with the issues drafted to cover it.]
### Constraints
[Each constraint.]
### Accepted Tensions
[Any already recorded; do not raise these again unless something about them changed.]

## Other open goals
[For each other open goal, and each other goal being drafted in the same session: its number
or "draft", its statement, and its members.]

## Scope
[For a new goal: every open issue. For an amendment: every open issue, judged against the
change only, which is: ...]

## Report, in these sections, in this order
1. Wording: changes the draft's statement, coverage or constraints need, given what you found.
2. The code: whether the code or the documentation already works against any of this goal's
   constraints today, citing the file and the passage. Describe what happens; call it a bug
   only when a rule the project states says so, and name the rule. Flag any constraint that
   is really a project-wide rule this goal's work could not plausibly break.
3. Members: for each open issue that contributes, which coverage items it serves; for each
   drafted member, whether its text honors every constraint, whether it is out of date (it
   predates a design it is now part of, or names things that no longer exist), and the
   amendment that would fix it, in one or two sentences.
4. Order: each dependency edge "X blocked by Y" that is a real prerequisite, with the reason
   quoted from the issues; preferences listed separately as preferences. A loop means a
   prerequisite that has no issue yet; name it.
5. Gaps: each coverage item no issue fully covers, and any part of the statement the coverage
   items miss, each with a suggested bridge issue as a title and one sentence.
6. Conflicts: each open issue that is not a member but threatens a constraint or a coverage
   item, quoting the passage and naming the mechanism.
7. Other goals: criteria that pull against another goal's, and issues that belong to both.

List unrelated issues as one line of numbers. Be concrete and conservative: a suspected
conflict still names the passage and the mechanism. Keep facts (what the code or an issue says
or does) apart from judgments (whether that is wrong), and label each judgment as one.
```

## Batching

On a large backlog, run several sweeps in parallel, each over a batch of the open issues with
the same brief, and merge their reports section by section before presenting them.
