---
name: start-task
description: >
  YOU MUST load this skill when the user wants to start work on a new task — including "start a
  new task", "let's work on {{ ticketIdExample }}", "begin a new task", "create a task file", or
  any request to begin fresh work on a ticket.
---

The agent performing this work MUST load `about-task-files` and any "about" skills related to the
project's task management system (e.g. Jira, Linear, etc.).

## Delegation

Per the sub-agent delegation pattern:

- **Orchestrator-only:** every step that needs the user (picking the ticket, confirming the branch
  name, approving the plan), the git branch operations, which change the working tree the
  orchestrator is in, and writing the task file (steps 4 and 5).
- **Delegated:** pulling ticket info (steps 2 and 4), to a background sub-agent.
- Sub-agents return links, questions, and confirmations to the orchestrator, which relays them to
  the user.

## Steps

### 1. Identify the Ticket

Look for a ticket identifier (e.g. `{{ ticketIdExample }}`) in the user's message. If none is
provided:
- Ask the user to specify one, or offer to help them pick one
- Once a ticket number is confirmed, proceed

### 2. Pull Ticket Info

Delegate to a sub-agent: fetch basic ticket info from the project's task management system and
report it back. If the ticket doesn't exist, go back to step 1. If unassigned, ask the user if they
want to assign it to themselves. If the status indicates it hasn't been started, ask if they want to
transition it to an active state. Those questions are orchestrator-only; the sub-agent reports the
assignee and status and the orchestrator asks.

After transitioning, ensure the issue is visible on the team's board. If the project ships an
"about" skill for its task management system (e.g. `about-jira`, `about-linear`), follow its
board-move instructions for the board type and target status.

### 3. Check for an Existing Branch

Look for local branches that include the ticket number:
```bash
git branch | grep {{ ticketIdExample }}
```

If found, confirm it's the right branch with the user (there may be multiple), then:
```bash
git checkout [branch-name]
git pull origin [branch-name]
```
Then go to step 4.

### 3a. Create a New Branch

If no existing branch is found:

1. Switch to the project's main development branch and pull latest
2. Resolve branch name: `{{ featureBranchPrefix }}{{ ticketPrefix }}[ticket-number]-[short-description]`
   derived from the ticket title. **Confirm with the user before creating.**
3. Create and switch to the branch:
   ```bash
   git checkout -b [branch-name]
   ```

### 4. Load or Create the Task File

Check for an existing task file at `{{ taskFileRoot }}/[branch-name].md`.

- **Found**: read it, note what's already captured, and continue to step 5
- **Not found**: delegate to a sub-agent, which collects full ticket info (summary, description,
  status, assignee, related issues, comments, story points, sub-tasks, any linked MRs or commits)
  and reports it back. The main session creates the task file from it, using the format in
  `about-task-files`. Include relevant testing URLs with real record IDs so URLs are actually
  clickable. Use `file:/absolute/path:line` format for source file links.

### 5. Plan and Start

The orchestrator drafts the task plan, organized by layer (see `about-task-files` for layer
ordering), and asks the user if they want to begin work. The main session records the approved
plan in the task file itself.

## Source for this Skill

This skill comes from the `workflow/task-files` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
