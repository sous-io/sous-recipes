# Design Tenets

- **Start from the ideal experience.** Before any technical design, describe the best possible
  outcome for whoever touches the thing (developer, user, operator), then work toward it.
  Compromise only after hitting real walls, name each wall, and keep looking first.
- **DRY.** One implementation per concern; a second copy is a defect.
- **Consistency.** The same input means the same thing everywhere.
- **Accept liberally, store strictly.** Accept every reasonable way to express an intent, settle
  it once, store and print only the canonical form, and always say what it resolved to.

Bad:  "The URL is ambiguous on GitLab, so require `/*` there."
Good: "Accept both forms everywhere; settle the ambiguity by looking up the candidate indexes."
