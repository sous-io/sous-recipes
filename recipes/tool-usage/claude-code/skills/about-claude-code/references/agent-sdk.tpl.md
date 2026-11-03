# The Claude Agent SDK

The Claude Agent SDK is Claude Code's agent loop packaged as a library for TypeScript and Python. It gives an application the same built-in tools, permissions, hooks, subagents, MCP support and sessions that the terminal tool has, driven from code. This file covers the SDK pages only. For the command-line equivalent (`claude -p`, output formats, CI use) read `references/agents-and-automation.md` or `references/review-and-ci.md`; for hooks, skills and plugins as they work in the terminal, read `references/extending.md` and `references/plugins-and-mods.md`.

## What the SDK is, and when to use it

The SDK spawns and supervises a Claude Code process (a native binary that both packages bundle) and talks to it over stdio. One agent session is one subprocess that owns a shell, a working directory and session files on disk. The packages are `@anthropic-ai/claude-agent-sdk` (TypeScript) and `claude-agent-sdk` (Python). The old names `@anthropic-ai/claude-code` and `claude-code-sdk` are the pre-rename packages.

Choosing between neighbors:

- **Agent SDK**: embed Claude Code's agent in a Python or TypeScript program, in a process the user operates, with callbacks for approvals, hooks and custom tools.
- **`claude -p` (headless CLI)**: one-off or scripted runs, shell pipelines, or any language other than Python and TypeScript (use `--output-format json` and parse it).
- **Interactive Claude Code**: daily development by a person at a terminal.
- **Client SDK / Messages API**: the program writes its own tool loop, with no built-in tools.
- **Managed Agents**: Anthropic hosts the agent loop and a sandbox for the user.

Authentication in the SDK is an API key (`ANTHROPIC_API_KEY`) or a cloud provider (Bedrock, Vertex, Foundry, and similar environment switches). The SDK does not load `.env` files by itself. Third-party products may not offer claude.ai login or its rate limits to their users.

## A minimal query call

`query()` returns an async iterator of messages; iterate it to completion rather than stopping at the result. This is the quickstart's bug-fixing agent, trimmed to its core.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review utils.py for bugs that would cause crashes. Fix any issues you find.",
  options: {
    allowedTools: ["Read", "Edit", "Glob"],
    permissionMode: "acceptEdits"
  }
})) {
  if (message.type === "result") {
    console.log(`Done: ${message.subtype}`);
  }
}
```

In Python the same call is `async for message in query(prompt=..., options=ClaudeAgentOptions(allowed_tools=[...], permission_mode="acceptEdits"))`, and message types are checked with `isinstance` instead of a `type` string. Python also has `ClaudeSDKClient` for multi-turn sessions, interrupts and mid-session setters, which `query()` does not offer.

Gotchas worth knowing before the first run:

- A single-shot `query()` yields the error result (for example `error_max_turns`) and then raises. Wrap the loop in try/catch if the program must continue.
- `allowedTools` pre-approves the listed tools; it does not remove other tools and does not constrain `bypassPermissions`. Hiding a tool means a bare name in `disallowedTools` or a `tools` list.
- Without a callback or an allow rule, a tool call that needs approval is denied in the default mode.

## Getting started

- **Agent SDK overview**: what the SDK is, the comparison with the CLI, Client SDK and Managed Agents, branding rules (do not call a product "Claude Code"), and the changelog links. [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- **Quickstart**: install for either language, set the API key, and build the bug-fixing agent above. Notes the one install trap: skipping npm optional dependencies leaves no bundled binary, so set `pathToClaudeCodeExecutable`. [Quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- **Migration guide**: the rename from the Claude Code SDK (packages, `ClaudeCodeOptions` to `ClaudeAgentOptions`). Two behavior points that surprise people: the SDK no longer uses the Claude Code system prompt by default, and an omitted `settingSources` loads user, project and local settings like the CLI does. [Migrate to Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/migration-guide)
- **Troubleshooting**: errors keyed by message (`CLINotFoundError`, `ProcessError`, "Claude Code process exited with code N", `structured_output` empty on a success result), plus a table routing feature-specific symptoms to the right page. [Troubleshoot the Agent SDK](https://code.claude.com/docs/en/agent-sdk/troubleshooting)

## Building

- **Configure your agent**: how to compose the options object (`model`, `fallbackModel`, `cwd`, `env`, `maxTurns`, `maxBudgetUsd`, `settings`, `effort`), the setters usable mid-session in streaming mode, and a table mapping every option to the page that explains it. Start here when the question is "which option does X". In TypeScript `env` replaces the subprocess environment (spread `process.env`); in Python it merges. [Configure your agent](https://code.claude.com/docs/en/agent-sdk/configuration)
- **Examples**: routes to the demo applications repository and the Cookbook's Python recipe series. [Examples](https://code.claude.com/docs/en/agent-sdk/examples)

## Core concepts

- **How the agent loop works**: turns, the message types (`SystemMessage` init, `AssistantMessage`, `UserMessage`, `StreamEvent`, `ResultMessage`), result subtypes, budget and turn caps, permission modes, effort levels, the context window and compaction. The best single page for the mental model. [How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- **Claude Code features in the SDK**: what `settingSources` loads (CLAUDE.md, rules, skills, commands, subagents, settings, filesystem hooks) and what it does not control (managed policy, `~/.claude.json`, auto memory, claude.ai connectors). Includes a "choose the right feature" table. Do not rely on defaults for multi-tenant isolation. [Use Claude Code features in the SDK](https://code.claude.com/docs/en/agent-sdk/claude-code-features)
- **Work with sessions**: continue (most recent session in the directory), resume (by ID), and fork (new session from a copy of history). Sessions persist the conversation, not the filesystem. Helper functions list, rename and tag sessions. [Work with sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
- **Persist sessions to external storage**: a `SessionStore` adapter (`append` and `load` required) mirrors transcripts to an object store, key-value store or database so another host can resume. It is a mirror of the local transcript, not a replacement, and it conflicts with `persistSession: false` and file checkpointing. [Persist sessions to external storage](https://code.claude.com/docs/en/agent-sdk/session-storage)

## Input and output

- **Streaming input**: the two input modes. Streaming input (an async generator or `ClaudeSDKClient`) is the recommended long-lived mode with image attachments, queued messages and interrupts; single-message mode suits one-shot and stateless jobs. [Streaming Input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- **Handle approvals and user input**: the `canUseTool` callback receives both tool-approval requests and Claude's `AskUserQuestion` clarifying questions. It never fires for auto-approved calls, so put checks that must run on every call in a `PreToolUse` hook. [Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
- **Stream responses in real time**: set `includePartialMessages` to receive raw API stream events (text and tool-input deltas) alongside complete messages. Subagent token deltas are not forwarded. [Stream responses in real-time](https://code.claude.com/docs/en/agent-sdk/streaming-output)
- **Structured output**: pass a JSON Schema (or Zod/Pydantic converted to draft-07) as `outputFormat` / `output_format` and read the validated `structured_output` from the result. A `success` subtype with no `structured_output` must be treated as a failure. [Get structured output from agents](https://code.claude.com/docs/en/agent-sdk/structured-outputs)

## Tools

- **Custom tools**: define functions with `tool()` / `@tool`, wrap them in an in-process MCP server (`createSdkMcpServer` / `create_sdk_mcp_server`), and allow them by their full name `mcp__<server>__<tool>`. Set `readOnlyHint` so Claude can run them in parallel. [Give Claude custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- **MCP**: external servers over stdio, HTTP or SSE, or from `.mcp.json`. MCP tools need explicit permission (use a wildcard such as `mcp__github__*` in `allowedTools`). The SDK does not run an interactive OAuth flow; pass a token in `headers`. Check the init message for `failed` or `needs-auth` servers. [Connect to external tools with MCP](https://code.claude.com/docs/en/agent-sdk/mcp)
- **Tool search**: on by default, so MCP and some built-in tool schemas load on demand instead of filling the context. Controlled by the `ENABLE_TOOL_SEARCH` environment variable. [Scale to many tools with tool search](https://code.claude.com/docs/en/agent-sdk/tool-search)
- **Subagents**: define them in the `agents` option (`description`, `prompt`, `tools`, `model`), and allow the `Agent` tool. The tool appears as `Agent` in messages but `Task` in the init tool list, so match both. Environment variables cap nesting depth and concurrency, and `maxBudgetUsd` covers their spend. [Subagents in the SDK](https://code.claude.com/docs/en/agent-sdk/subagents)

## Behavior

- **System prompts**: the SDK default is a minimal prompt, unlike `claude -p`. Choices are the `claude_code` preset (optionally with `append`), a custom string, CLAUDE.md files, and output styles. `excludeDynamicSections` improves prompt caching across machines. [Modifying system prompts](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- **Skills**: skills are files on disk (`.claude/skills/<name>/SKILL.md`); there is no registration API. The `skills` option selects which are invocable, and sending `/<name>` as a prompt dispatches a command regardless of that list. [Extend agents with skills](https://code.claude.com/docs/en/agent-sdk/skills)
- **Plugins**: load local plugin directories with `plugins: [{ type: "local", path }]`; marketplace plugins must be downloaded first. Plugin skills are namespaced `plugin:skill`. [Plugins in the SDK](https://code.claude.com/docs/en/agent-sdk/plugins)

## Control and observability

- **Permissions**: a fixed evaluation order (hooks, deny rules, ask rules, permission mode, allow rules, `canUseTool`), plus the modes `default`, `dontAsk`, `acceptEdits`, `plan`, `auto` and `bypassPermissions`. `bypassPermissions` is refused as root outside a sandbox. [Configure permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- **Hooks**: callback hooks passed in `options.hooks` run in your process, side by side with shell hooks loaded from settings. TypeScript supports many more events than Python (for example `SessionStart` and `SessionEnd` are TypeScript-only callbacks). [Intercept and control agent behavior with hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
- **File checkpointing**: `enableFileCheckpointing` plus the `replay-user-messages` extra argument yields user-message UUIDs; `rewindFiles()` restores files from Write, Edit and NotebookEdit changes. It does not undo Bash edits or subagent edits, and does not rewind the conversation. [Rewind file changes with checkpointing](https://code.claude.com/docs/en/agent-sdk/file-checkpointing)
- **Cost tracking**: `total_cost_usd` and `modelUsage` on the result are client-side estimates, not billing data. Deduplicate per-step usage by message ID, and read output tokens from the result. [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- **OpenTelemetry**: the bundled CLI exports metrics, log events and (beta) traces to an OTLP backend, configured through environment variables. Never use the `console` exporter, because stdout is the SDK message channel. [Observability with OpenTelemetry](https://code.claude.com/docs/en/agent-sdk/observability)
- **Todos**: structured `TaskCreate` and `TaskUpdate` tool calls let an application render progress. Newer models do not get these tools by default; opt in with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` or by naming a task tool in `allowedTools`. [Track todos](https://code.claude.com/docs/en/agent-sdk/todo-tracking)

## Deployment

- **Hosting**: each session is a long-lived subprocess with state on local disk, so choose a session pattern (ephemeral, long-running, hybrid with a `SessionStore`, or multi-agent container), size memory per session, and isolate tenants with `settingSources: []`, a per-tenant `cwd` and `CLAUDE_CONFIG_DIR`, and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting)
- **Secure deployment**: threat model (prompt injection) and layered controls: sandbox runtime, hardened containers, gVisor, microVMs, and a credential-injecting proxy outside the agent's boundary so the agent never sees secrets. [Securely deploying AI agents](https://code.claude.com/docs/en/agent-sdk/secure-deployment)

## References

- **TypeScript reference**: every `Options` field, `query()` and its control methods, `startup()` and `prewarm()`, `tool()`, `createSdkMcpServer()`, session helpers, message and hook types, and bundling notes. The page is very large; fetch a specific anchor. [Agent SDK reference - TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript)
- **Python reference**: `query()` versus `ClaudeSDKClient`, `ClaudeAgentOptions`, `@tool`, session functions, message and hook types. [Agent SDK reference - Python](https://code.claude.com/docs/en/agent-sdk/python)
- **TypeScript V2 session API (removed)**: `unstable_v2_createSession`, `unstable_v2_resumeSession` and `unstable_v2_prompt` were removed in TypeScript SDK 0.3.142. Do not write new code against them; use `query()` with `resume`, `continue` or an async-iterable prompt. The page remains only for code pinned to 0.2.x. [TypeScript SDK V2 session API (removed)](https://code.claude.com/docs/en/agent-sdk/typescript-v2-preview)

## Choosing between

- Need one answer from a shell script: `claude -p`. Need approvals, custom tools or hooks in code: the SDK.
- Multi-turn in one process: `ClaudeSDKClient` (Python) or streaming input or `continue: true` (TypeScript). Across restarts: capture the session ID and use `resume`. Across hosts: add a `SessionStore`.
- Context isolation or parallel review: subagents. Dozens to hundreds of agents orchestrated by a script: the `Workflow` tool (TypeScript) described on the subagents page.
- Reusable instructions loaded on demand: skills on disk. Always-on project rules: CLAUDE.md through `settingSources`. Per-call logic in code: hooks or `canUseTool`.
