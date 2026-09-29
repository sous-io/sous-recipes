## Sources of Truth

Three kinds of artifact record how this project works, and each answers exactly one question:

- **The docs** (`{{ docsDir }}`) answer "how does it work right now?". They are the living record:
  updated whenever behavior changes, and they never carry history.
- **Decision records** (`{{ adrDir }}`) answer "what did we decide, and why?". An accepted record is
  never amended; a later record references it and overrides it. A draft may be edited in place. The
  first record for a system holds its full initial design; each later one holds only the change.
- **Issues** ({{ issueTracker }}) answer "what work happened, and how did we get there?". An issue is
  the process record, including design changes made along the way.

Authority passes in a fixed order for every effort:

1. While the effort's issue is open, the issue is the source of truth for the design, which may still
   change during implementation.
2. When the issue closes, its decision record is brought in line with what was actually built and
   becomes the permanent record.
3. The docs absorb the outcome and remain the answer to "right now".

Updating the docs and writing the decision record are part of finishing any effort that changes
designed behavior, never optional follow-ups.

When code or data proves a doc line wrong, correct it in the same pass, in the file's own voice, and
mention the fix in your report. A stale doc is a defect, not a question for the user.
