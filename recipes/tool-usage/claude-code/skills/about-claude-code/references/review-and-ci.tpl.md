# Code Review, Security Scans and CI

This branch covers every way Claude Code reviews code and runs inside pipelines: the local
`/code-review` command, the cloud ultrareview, the managed Code Review service on GitHub pull
requests, the two security plugins, GitHub Enterprise Server support, and the GitHub Actions and
GitLab CI/CD integrations. For cloud sessions and auto-fix on pull requests read
`references/surfaces.md`; for headless `-p` runs and the Agent SDK read `references/agent-sdk.md`;
for skills, subagents and hooks that a custom reviewer would be built from read
`references/extending.md`.

Several products share the "review" name, and they read different files and bill differently. The
agent should work out which one the user means before answering.

## Choosing between

- **`/code-review` (local)**: the user wants feedback on their own branch, a teammate's PR, a path
  or a commit range right now, in their session, on any plan. Counts as normal session usage.
- **`/code-review ultra` (ultrareview)**: the user wants a deeper pre-merge pass on a substantial
  change and has a claude.ai login. Runs in a cloud sandbox with a multi-agent fleet and independent
  verification; takes minutes, not seconds; a few free runs, then billed as usage credits.
- **Managed Code Review**: the organization (Team or Enterprise) wants every GitHub pull request
  reviewed automatically, with inline comments and a check run, without writing a workflow. An
  Owner turns it on; billed to the organization as usage credits.
- **A CI action (GitHub Actions or GitLab CI/CD)**: the team wants Claude in its own pipeline with
  its own prompt, triggers, model and runners, often for more than review (implementing issues,
  scheduled reports). Works with an API key, a subscription token or a cloud provider.
- **A custom reviewer (subagent or skill)**: the team wants its own review recipe; a project skill
  named `code-review` replaces the bundled command.

Security has its own ladder, from earliest to latest: the security-guidance plugin (while Claude
writes), `/security-review` (one pass on the branch), the Claude Security plugin (deep on-demand
scan), managed Code Review (on the PR), and the managed Claude Security product (Enterprise,
monitors repositories).

## Local review with /code-review

`/code-review` is a bundled skill, so there is no `SKILL.md` on disk to edit. It reviews for
correctness bugs, and depending on model and effort also covers reuse, simplification and
efficiency. It runs as a background forked subagent, so the findings arrive in the conversation
when it finishes and do not fill the main context.

- **Targets**: with no target it reviews the branch's commits ahead of upstream plus uncommitted
  changes (falling back to `main` when there is no upstream). A target after the level and flags
  can be a PR number, a branch, a path or a git range.

  ```text
  /code-review high
  /code-review 1234
  /code-review main...my-feature
  /code-review src/auth --fix
  ```

- **Effort level**: the first argument (`low` through `max`) trades confidence for coverage; `low`
  reports only the surest findings. The last level the user typed is remembered across sessions and
  reused when none is given; levels passed in `-p` runs are not remembered.
- **`--fix`**: applies the findings to the working tree after the review, through the permission
  mode. Gotcha: a background review's edits happen outside the session's checkpoints, so `/rewind`
  does not undo them; use git.
- **`--comment`**: posts findings as inline comments on a GitHub PR, or as a single note on a
  GitLab merge request through the `glab` CLI (pass the MR URL or `!123` on self-managed GitLab).
- **`--max-findings`**: raises or lowers the cap on findings (`<n>`, `all`, or `default` to clear a
  remembered value).
- **Instructions**: follows `CLAUDE.md`, never `REVIEW.md` (that file is only for the managed
  service).
- **Who starts it**: Claude may start the review on its own when asked in plain words, and
  session-scoped scheduled tasks can run it. To keep it user-only, set a `skillOverrides` entry of
  `"code-review": "user-invocable-only"`. Claude never starts an ultrareview on its own.
- **Foreground runs**: `-p` mode, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, or running it again while
  one is in progress makes it run in the foreground.
- **Renames**: `/review` is now an alias of `/code-review` (it used to be a separate read-only PR
  review). The bug-finding command was once called `/simplify`; today `/simplify` is a separate
  cleanup-only command that applies its fixes, and `/verify` runs the app to confirm a change.
- In the desktop app and other hosts that request it, findings come back through a `ReportFindings`
  tool as a structured list instead of text.

[Review locally with /code-review](https://code.claude.com/docs/en/code-review-local)

## Ultrareview (cloud multi-agent review)

- **What it is**: `/code-review ultra` (alias `/ultrareview` where available) launches a fleet of
  reviewer agents in a cloud sandbox. Every reported finding is independently reproduced and
  verified, so results skew toward real bugs. Research preview.
- **Scope**: the current branch against the default branch plus uncommitted and staged changes
  (uploaded as a bundle, with credential-like files such as `.env` held back), or a `github.com`
  PR by number (cloned in the cloud; nothing uploaded). A single word is read as a base branch or
  PR; several words become a note the review relates its findings to. There are diff-size limits;
  the refusal message names them. Very large repositories are pushed toward PR mode.
- **Posting**: on a `github.com` PR the user can choose to post the findings as one plain comment
  from their own GitHub account (`--post`); the default is not to post. The interactive session
  must stay open until the review finishes for the post to happen.
- **Scripts and CI**: `claude ultrareview [PR|base]` blocks until the findings arrive and prints them
  to stdout (`--json` for the raw payload, `--trust-workspace` for untrusted CI checkouts). Gotcha:
  `claude -p '/code-review ultra'` exits before the findings arrive, so scripts MUST use the
  subcommand.
- **Billing shape**: a small one-time allotment of free runs per account on Pro, Max and Ultra,
  then each run bills as usage credits (outside plan usage), and usage credits must be turned on
  first. The launch dialog shows the estimate; check the page for current prices.
- **Availability**: needs a claude.ai login. Not on Bedrock, Agent Platform or Foundry, and not for
  Zero Data Retention, HIPAA or CMEK organizations; there `/code-review ultra` falls back to a local
  review. Track or stop running reviews with `/tasks`.

[Find bugs with ultrareview](https://code.claude.com/docs/en/ultrareview)

## Managed Code Review on GitHub

A hosted service for Team and Enterprise organizations. Several agents read each PR's diff and the
surrounding code in parallel, a verification step filters false positives, findings are deduplicated
and ranked, and the review posts inline comments, a summary and a check run named
**Claude Code Review**. It reads code only (no build, no run), never approves or blocks, and its
check run never concludes as a failure. It does not run in self-hosted environments, and it is not
available to Zero Data Retention, HIPAA or CMEK organizations.

[Code Review](https://code.claude.com/docs/en/code-review)

- **Setup**: an Owner enables it in claude.ai admin settings, installs the Claude GitHub App (the
  same app GitHub Actions and auto-fix use), and picks repositories, or covers a whole github.com
  organization (requires a spend limit). Each repository chooses when reviews run: once after PR
  creation, after every push (the default for new repositories, and the most expensive), or manual.
  A review level (Quick, Standard, Deep) is set org-wide and can be overridden per repository; there
  is no model choice. [Set up Code Review](https://code.claude.com/docs/en/code-review-setup)
- **Customize**: `CLAUDE.md` files (root and those above each changed file) are read as context;
  `REVIEW.md` at the root (plus optional subdirectory copies) holds review-only rules: redefine
  what counts as Important, cap nits, skip generated paths, add team checks, demand evidence.
  `REVIEW.md` is read from the base or default branch, never from the PR itself, and the stronger
  instructions (lowering severity, excluding paths, nit caps, `@file` includes, including a skill's
  `SKILL.md`) apply only when that branch is protected. Includes have size and count limits.
  [Customize Code Review](https://code.claude.com/docs/en/code-review-customize)
- **On the pull request**: severities are Important, Nit and Pre-existing. Resolve a thread to
  dismiss a finding; a reply alone does not, and replies are read only by the next review. Comment
  commands must be a new top-level comment from someone with write access: `@claude review` (one
  review), `@claude review always` (subscribe to push reviews), `@claude review stop`. Drafts and
  fork PRs are skipped automatically but can be reviewed on request. A CI job can gate merges by
  parsing the severity-count JSON on the last line of the check run's details text.
  [Read and request reviews on a pull request](https://code.claude.com/docs/en/code-review-pull-requests)
- **Gotcha**: if the repository also runs the GitHub Action with the default `@claude` trigger, an
  `@claude review` comment starts the Action too; change the Action's `trigger_phrase`.
- **Costs**: token-based, billed to the organization as usage credits (separate from plan usage,
  and on the Anthropic bill even for orgs that use cloud providers elsewhere). Cost scales with the
  review level, the change size and how often reviews run. A monthly Code Review spend limit, the
  org spend limit and the credit balance can each cause reviews to be skipped with a budget
  comment. [Code Review costs and usage](https://code.claude.com/docs/en/code-review-costs)
- **Troubleshooting**: start from the check run title (queued, found no issues, skipped with no new
  changes, not repeated because findings are still open, failed, timed out), then the budget
  message, re-runs, findings that appear only in the check run details, and `REVIEW.md` problems.
  [Troubleshoot Code Review](https://code.claude.com/docs/en/code-review-troubleshooting)

## GitHub Enterprise Server

Team and Enterprise organizations can connect a self-managed GHES instance once (an Owner creates a
GitHub App from a generated manifest, in claude.ai Git providers settings). After that, cloud
sessions (`claude --cloud`, detected from the git remote), `--teleport`, managed Code Review, Claude
Security and plugin marketplaces work against GHES. Not supported: `/install-github-app` (GitHub
Actions needs manual workflow setup), the GitHub MCP server (use `gh auth login --hostname`
instead), contribution metrics, ultrareview PR mode, and covering a whole organization in Code
Review. The instance must be reachable from Anthropic's outbound IPs for hosted sessions and
reviews. Marketplaces on GHES need full git URLs, since `owner/repo` always means github.com.
[Claude Code with GitHub Enterprise Server](https://code.claude.com/docs/en/github-enterprise-server)

## Security plugins

Both are official-marketplace plugins (`claude-plugins-official`), work on all plans, and run
locally in the session, so they count toward normal usage.

- **security-guidance**: once installed it runs automatically, built entirely on hooks. Three
  layers: a per-edit pattern match with no model call (eval, pickle, `innerHTML`, workflow files),
  a background security review of each turn's git diff, and a deeper agentic review when Claude
  itself runs `git commit` or `git push` (commits the user makes are not reviewed). Findings are fed
  back to Claude to fix; nothing blocks. Extend it with `.claude/claude-security-guidance.md` and
  `.claude/security-patterns.yaml` (additive only); turn layers off with `ENABLE_*=0` variables.
  Needs Python and a git repository. Cloud sessions do not load it from user or repository
  settings. [Catch security issues as Claude writes code](https://code.claude.com/docs/en/security-guidance)
- **claude-security**: adds `/claude-security`, a multi-agent vulnerability scan of a whole
  repository, a focused area, a branch diff, a PR or one commit, at effort `low`, `medium` or `high`.
  It builds a threat model, hunts, and has independent agents verify each finding before it is
  reported. Results land in a git-ignored `CLAUDE-SECURITY-<timestamp>/` directory (Markdown,
  JSONL and SARIF). "Suggest patches" writes reviewed `F<n>.patch` files that are never applied
  automatically. Uses dynamic workflows (on Pro, enable them in `/config`) and works best in auto
  mode. Scans are nondeterministic; run them more than once on large code.
  [Scan your codebase for vulnerabilities](https://code.claude.com/docs/en/claude-security)

## GitHub Actions

`anthropics/claude-code-action@v1` runs Claude Code in a workflow. It is built on the Agent SDK.

- **Setup**: `/install-github-app` (github.com only) installs the Claude GitHub App, stores a secret
  (`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` for a subscription),
  and opens a PR with the workflow files. Manual setup copies `examples/claude.yml`. For an org-wide
  shared secret prefer an API key, or skip secrets entirely with workload identity federation
  (GitHub OIDC exchanged through a Claude Console service account).
- **Modes**: with no `prompt` input it is interactive and answers the trigger phrase (`@claude`) in
  comments, reviews and new issues; with a `prompt` it runs as automation on any event, including
  cron. The prompt can be a skill (`/skill-name` after `actions/checkout`, or
  `/plugin:skill` with the `plugins` and `plugin_marketplaces` inputs).
- **Review workflow**: runs the `code-review` plugin's skill; `--comment` makes it post inline
  comments, and `claude_args` MUST keep the `--allowedTools` entry for the inline-comment MCP tool.
- **Who can trigger**: the actor needs write access (`allowed_non_write_users` to widen) and bots are
  rejected unless listed in `allowed_bots`.
- **Gotchas**: commits made with the default `GITHUB_TOKEN` do not trigger other workflows, so let the
  Action authenticate as the app. The app's permission set is shared by every Claude GitHub feature
  and cannot be partially accepted; build a custom app for least privilege. CLI flags go through
  `claude_args` (`--max-turns`, `--model`, `--allowedTools`). Workflows still on `@beta` need the
  documented migration (`mode` removed, `direct_prompt` became `prompt`).
  [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- **Cloud providers**: set `use_bedrock`, `use_vertex` or `use_foundry` to `"true"` and configure the
  cloud to trust the workflow's OIDC token, so no static cloud keys are stored. Choose a GitHub
  identity: the official app, a custom app with only Contents, Issues and Pull requests, or
  `GITHUB_TOKEN` (which will not trigger CI on Claude's commits).
  [Use Claude Code GitHub Actions with cloud providers](https://code.claude.com/docs/en/github-actions-cloud-providers)

## GitLab CI/CD

A beta integration maintained by GitLab, not Anthropic. A job in `.gitlab-ci.yml` runs `claude -p`
with a masked `ANTHROPIC_API_KEY` (or Bedrock or Agent Platform through OIDC or Workload Identity
Federation). Mention-driven runs (`@claude` in an issue or MR) need the team's own webhook listener
that calls the pipeline trigger API with `AI_FLOW_*` variables; nothing listens for mentions by
default. Claude writes back through `CI_JOB_TOKEN` or a project access token and the `mcp__gitlab`
tool. For quick reviews of a GitLab MR from a local session, `/code-review --comment` with `glab`
is simpler. [Claude Code GitLab CI/CD](https://code.claude.com/docs/en/gitlab-ci-cd)
