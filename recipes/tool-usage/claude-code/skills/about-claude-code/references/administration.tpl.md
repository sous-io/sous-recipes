# Administration: Organizations, Providers, Gateways, Costs and Security

This branch covers how an organization deploys and governs Claude Code: sign-in and managed policy, third-party model providers, gateways, network setup, usage and cost visibility, and security and data handling. Much of it is for administrators, but the provider and feature-availability entries matter to individuals too, because many features are missing on Bedrock, Foundry, Google Cloud and Claude Platform on AWS. For permission rules, sandboxing and settings keys, read `references/configuring.md`. For CI and automation, read `references/review-and-ci.md`. For hooks, plugins and mods that administrators also manage, read `references/plugins-and-mods.md`.

## Setup and access

Policy reaches developers through managed settings, which sit above user, project and local settings. The default choice for most organizations is a Claude for Teams or Enterprise plan; the other paths are the Claude Console, a cloud provider, or a gateway.

- **Organization setup map**: A decision map in order: choose the API provider, choose how settings reach devices, choose what to enforce, set up usage visibility, review data handling. Its "what to enforce" table is the quickest index of managed-only keys (login enforcement, provider allowlists, version floors, plugin and MCP restrictions, model restrictions).
  [Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup)
- **Advanced setup**: Install methods (native installer, Homebrew, WinGet, apt, dnf, apk, npm), release channels (`autoUpdatesChannel` set to `stable` or `latest`), the `minimumVersion` floor, and update controls. `DISABLE_AUTOUPDATER` stops only the background check; `DISABLE_UPDATES` blocks every update path including `claude update`. Package-manager installs do not auto-update unless the user opts in.
  [Advanced setup](https://code.claude.com/docs/en/setup)
- **Authentication**: Subscription login, Console login (with or without an API key), cloud provider credentials, Claude apps gateway SSO, and `claude setup-token` for a one-year `CLAUDE_CODE_OAUTH_TOKEN` in CI. When several credentials exist, the order is cloud provider variables, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper`, the OAuth token, profiles, then the `/login` subscription; a stray `ANTHROPIC_API_KEY` silently overrides a subscription once approved. Use `CLAUDE_CONFIG_DIR` to keep two accounts apart.
  [Authentication](https://code.claude.com/docs/en/authentication)
- **Managed settings (device delivery)**: Deliver `managed-settings.json` (plus an optional `managed-settings.d/` directory), a macOS plist or Windows registry policy. By default Claude Code uses the first managed source that delivers any key, not a merge, with a few per-key exceptions. The HKCU registry location is user-writable, so treat it as a convenience and not enforcement. Verify with `/status` (the `Setting sources` line) or `claude doctor`.
  [Deploy managed settings](https://code.claude.com/docs/en/managed-settings)
- **Server-managed settings**: Configure managed settings from the claude.ai admin console (Teams or Enterprise, Owner role), with no device management needed. Clients fetch at startup and hourly. They apply only to sessions authenticated with an eligible claude.ai credential connecting to `api.anthropic.com`; third-party provider variables or a custom `ANTHROPIC_BASE_URL` skip the fetch entirely. Settings are organization-wide (no per-group policy), and `forceRemoteSettingsRefresh` makes startup fail closed. This is a client-side control, not a security boundary on unmanaged devices.
  [Configure server-managed settings](https://code.claude.com/docs/en/server-managed-settings)
- **Managed MCP**: Three levers. A `managed-mcp.json` file takes exclusive control of MCP (and suppresses claude.ai connectors unless `allowAllClaudeAiMcps` is set). `managedMcpServers` in managed settings provides remote servers alongside the user's own. `allowedMcpServers` and `deniedMcpServers` filter by URL, command or name; a `serverName` match is a label, not a security control.
  [Control MCP server access for your organization](https://code.claude.com/docs/en/managed-mcp)
- **Auto mode configuration**: The `autoMode` settings block tells the auto mode classifier which repos, buckets and domains the organization trusts (`environment`), and can extend or replace its `allow`, `soft_deny` and `hard_deny` rule lists. Include the literal string `"$defaults"` in an array to keep the built-in rules; omitting it replaces them. The classifier ignores `autoMode` in project settings. Inspect with `claude auto-mode defaults`, `config` and `critique`, or draft entries with `/auto-mode-setup`.
  [Configure auto mode](https://code.claude.com/docs/en/auto-mode-config)

```json
{
  "autoMode": {
    "environment": [
      "$defaults",
      "Source control: github.example.com/acme-corp and all repos under it",
      "Trusted cloud buckets: s3://acme-build-artifacts"
    ]
  }
}
```

### Choosing between

- Organization has MDM or endpoint management: file or plist/registry managed settings (harder for users to tamper with).
- No device management, users on claude.ai Teams or Enterprise: server-managed settings.
- Both: deploy both, since endpoint-managed settings do not reach cloud sessions and server-managed settings do not reach third-party provider sessions.

## Deployment

### Third-party providers

Claude Code can use Amazon Bedrock, Claude Platform on AWS, Google Cloud's Agent Platform (formerly Vertex AI) or Microsoft Foundry instead of Anthropic directly. Each is selected with a provider variable (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`). Always pin model versions with the `ANTHROPIC_DEFAULT_*_MODEL` variables when deploying to a team, because built-in aliases can lag the newest release or point at a model the account has not enabled.

- **Enterprise deployment overview**: Compares billing, regions, authentication and cost tracking across Teams/Enterprise, Console and each cloud provider, and explains proxy versus gateway. `allowedProviders` in managed settings limits which providers a machine may use.
  [Enterprise deployment overview](https://code.claude.com/docs/en/third-party-integrations)
- **Feature availability**: The matrix to check before assuming a feature exists. Everything local works on every provider (CLI, IDE extensions, subagents, hooks, skills, plugins, MCP, checkpoints, sandboxing, OpenTelemetry). Features that need a claude.ai login are not reachable on any cloud provider or with a Console key: cloud sessions, Remote Control, Desktop, cloud scheduled tasks (`/schedule`), Ultrareview, Code Review, the Chrome extension, computer use, artifacts and voice dictation. Fast mode, the advisor and Channels are also unavailable on every cloud provider. Web search is missing on Bedrock. Analytics dashboards and server-managed settings are unavailable on all cloud providers. On those providers use `/loop` instead of `/schedule`, and GitHub Actions or GitLab CI instead of cloud sessions.
  [Feature availability](https://code.claude.com/docs/en/feature-availability)
- **Amazon Bedrock**: Run `/setup-bedrock` (wizard) or set `CLAUDE_CODE_USE_BEDROCK` plus AWS credentials from the normal AWS credential chain, an SSO profile, or a Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK`). `awsAuthRefresh` and `awsCredentialExport` handle credential refresh. A separate Mantle endpoint is enabled with `CLAUDE_CODE_USE_MANTLE`. Claude Code uses the Invoke API, not Converse.
  [Claude Code on Amazon Bedrock](https://code.claude.com/docs/en/amazon-bedrock)
- **Claude Platform on AWS**: The Anthropic-operated Claude API reached with AWS credentials (SigV4) or a workspace API key, billed through AWS Marketplace. Needs `CLAUDE_CODE_USE_ANTHROPIC_AWS` and `ANTHROPIC_AWS_WORKSPACE_ID`. It is a separate Anthropic organization from any existing Console account, and its credentials do not transfer.
  [Claude Code on Claude Platform on AWS](https://code.claude.com/docs/en/claude-platform-on-aws)
- **Google Cloud's Agent Platform**: Run `/setup-vertex` or set `CLAUDE_CODE_USE_VERTEX`, `CLOUD_ML_REGION` and `ANTHROPIC_VERTEX_PROJECT_ID`. The login prompt still labels it "Google Vertex AI". Some models are not served on global endpoints and need a per-model `VERTEX_REGION_CLAUDE_*` variable.
  [Claude Code on Google Cloud's Agent Platform](https://code.claude.com/docs/en/google-vertex-ai)
- **Microsoft Foundry**: Set `CLAUDE_CODE_USE_FOUNDRY` and `ANTHROPIC_FOUNDRY_RESOURCE` (resource name only, not a URL). Authenticates with an API key, Microsoft Entra ID, or a bearer token. There is no setup wizard and no startup model check, so pin models to your deployment names or requests fail.
  [Claude Code on Microsoft Foundry](https://code.claude.com/docs/en/microsoft-foundry)

### Network, launcher and containers

- **Network configuration**: Proxy variables (`HTTPS_PROXY`, `NO_PROXY`; SOCKS is not supported), custom CAs (`NODE_EXTRA_CA_CERTS`, `CLAUDE_CODE_CERT_STORE`), and mTLS (`CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`). It also lists the hosts to allowlist and documents the streaming watchdogs: `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS`, `CLAUDE_ENABLE_STREAM_WATCHDOG`, `CLAUDE_ENABLE_BYTE_WATCHDOG`, `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK`, `API_FORCE_IDLE_TIMEOUT` and `API_TIMEOUT_MS`. Which watchdog runs depends on the connection type, so read the table before tuning. Background agents share one supervisor process, so set network variables in settings `env`, not only in the shell.
  [Enterprise network configuration](https://code.claude.com/docs/en/network-config)
- **Retry watchdog (unattended sessions)**: `CLAUDE_CODE_RETRY_WATCHDOG=1` retries 429 and 529 capacity errors indefinitely, for CI or remote workers, with `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` to bound each wait and `CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS` to recheck a lifted usage limit. `CLAUDE_CODE_MAX_RETRIES` sets the normal retry count. These live in the env-vars and errors reference pages, not in the network page; see `references/reference-and-troubleshooting.md`.
- **Corporate launcher**: `CLAUDE_CODE_PROCESS_WRAPPER` (or the `processWrapper` setting) starts every process Claude Code launches from its own binary, including the background supervisor and agent view sessions, through a required launcher that must end with `exec "$@"`. A wrapper on `PATH` cannot reach those processes. It is ignored on Windows, and project settings cannot set it.
  [Run Claude Code behind a corporate launcher](https://code.claude.com/docs/en/corporate-launcher)
- **Dev containers**: Install Claude Code with the Dev Container Feature; mount a volume at `~/.claude` and set `CLAUDE_CONFIG_DIR` to persist login across rebuilds. Containers allow `--dangerously-skip-permissions` for unattended work, but a malicious repo can still exfiltrate anything inside the container, so use trusted repos and an egress firewall.
  [Development containers](https://code.claude.com/docs/en/devcontainer)

## Gateways

A gateway is a proxy the organization runs between Claude Code and the model provider, giving one place for credentials, usage tracking, budgets and audit logs. Two families exist: Anthropic's own Claude apps gateway, built into the `claude` binary, and gateway products the organization already runs. Setting only `ANTHROPIC_BASE_URL` keeps the subscription login active; setting a gateway credential (`ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper`) or signing in to a Claude apps gateway turns subscription login off for that session and bills the gateway's provider account.

- **Gateway overview**: Architecture, how to choose, and what is configured separately from the gateway (model choice, direct Anthropic egress for version checks, client telemetry).
  [Run Claude Code through a gateway](https://code.claude.com/docs/en/gateways)
- **Claude apps gateway**: Self-hosted gateway started with `claude gateway --config gateway.yaml`. Developers sign in with the corporate IdP through `/login`; the gateway enforces model access and delivers managed settings by IdP group, and emits OTLP telemetry. Upstreams are Bedrock, Claude Platform on AWS, Google Cloud, Foundry or the Anthropic API. It has no SAML or non-OIDC auth, no service-token flow for CI, and gateway sessions lose Remote Control, `/design-sync` and server-side web search. Claude Code refuses a gateway whose hostname resolves to a public IP, so plan a private address.
  [Claude apps gateway](https://code.claude.com/docs/en/claude-apps-gateway)
- **Gateway configuration**: Reference for every `gateway.yaml` section (`listen`, `oidc`, `session`, `store`, `upstreams`, then optional `admin`, `managed`, `telemetry`, `limits`, `models` and more).
  [Claude apps gateway configuration](https://code.claude.com/docs/en/claude-apps-gateway-config)
- **Spend limits**: Per-user, per-group or organization caps by day, week or month, set through an admin API on the gateway (not in `gateway.yaml`). Over-cap requests get a 429 until the period resets; amounts are the gateway's own estimates, a circuit breaker and not an invoice.
  [Claude apps gateway spend limits](https://code.claude.com/docs/en/claude-apps-gateway-spend-limits)
- **Deploy and operate**: Register the IdP client, build the container, deploy to Kubernetes or Cloud Run, then health checks, secret rotation and upgrades.
  [Claude apps gateway deployment and operations](https://code.claude.com/docs/en/claude-apps-gateway-deploy)
- **Worked cloud examples**: End-to-end deployments on [AWS](https://code.claude.com/docs/en/claude-apps-gateway-on-aws) (ECS Fargate or EKS, RDS, Secrets Manager, Bedrock) and [Google Cloud](https://code.claude.com/docs/en/claude-apps-gateway-on-gcp) (Cloud Run or GKE, Cloud SQL, Secret Manager).
- **Other LLM gateways**: For a gateway the organization already runs. Anthropic does not endorse or audit these, and does not support routing Claude Code to non-Claude models. Three companion pages: [connect Claude Code to a gateway](https://code.claude.com/docs/en/llm-gateway-connect) (base URL and credential), [roll out a gateway](https://code.claude.com/docs/en/llm-gateway-rollout) (issue credentials, distribute managed settings), and the [compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol) (endpoints, headers and body fields that must be forwarded, or features break). A separately maintained gateway must be updated as Claude Code releases change what it sends.
  [Other LLM gateways](https://code.claude.com/docs/en/llm-gateway)

## Usage and costs

- **Monitoring**: OpenTelemetry export, enabled with `CLAUDE_CODE_ENABLE_TELEMETRY=1` and `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` plus an OTLP endpoint and protocol (there is no default protocol). Covers metrics, events and beta traces. Prompt text is redacted unless `OTEL_LOG_USER_PROMPTS=1`. Deliver exporter settings through managed settings so users and repos cannot redirect them.
  [Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- **Cost management**: `/usage` shows session cost (computed locally at list price) and, on subscriptions, a plan usage breakdown. The `modelPricing` managed setting makes reported figures match contracted rates. Organization-level spend caps live in the claude.ai admin console (Teams/Enterprise), Console workspaces, or the cloud provider; per-user attribution on cloud providers needs OpenTelemetry or a gateway. The page also lists the main token-saving habits (clear between tasks, choose the model, trim MCP, lower effort).
  [Manage costs effectively](https://code.claude.com/docs/en/costs)
- **Analytics**: Dashboards for adoption, contribution metrics (needs the GitHub app; not available with zero data retention) and a leaderboard on Teams and Enterprise at claude.ai, and per-user spend on the Console. Not available on cloud providers; Enterprise also has an Analytics API.
  [Track team usage with analytics](https://code.claude.com/docs/en/analytics)

## Security and data

- **Security**: Permission-based architecture, sandboxed Bash, prompt-injection safeguards, MCP and cloud-execution security, and the vulnerability reporting path. Read this for the threat model behind the managed controls.
  [Security](https://code.claude.com/docs/en/security)
- **Data usage**: Commercial plans, API and third-party platforms are not used for model training by default; consumer accounts depend on a privacy setting. Documents retention, telemetry opt-outs (`DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) and a table of defaults by provider; on cloud providers telemetry, error reports and `/feedback` are off by default. The WebFetch domain check still contacts `api.anthropic.com` unless `skipWebFetchPreflight` is set.
  [Data usage](https://code.claude.com/docs/en/data-usage)
- **Zero data retention**: Per-organization enablement by Anthropic for qualified Enterprise accounts, not self-service. Turns off features that must store content: cloud sessions, Remote Control, artifacts, Claude Tag and `/feedback`. Sessions only count if they sign in to the ZDR organization, so pair it with `forceLoginOrgUUID`.
  [Zero data retention](https://code.claude.com/docs/en/zero-data-retention)
- **HIPAA setup**: For Claude Enterprise organizations with the HIPAA configuration and a BAA. It applies only to local mode with an Enterprise sign-in connecting directly to the Claude API; gateways, cloud providers, custom base URLs and Console keys are not eligible. Requires minimum client versions, turns off WebFetch, cloud sessions, Remote Control, `/feedback` and artifacts, and strips Anthropic credentials from child processes.
  [Set up Claude Code (local mode) for a HIPAA-ready organization](https://code.claude.com/docs/en/hipaa-setup)

## Adoption kits

- **Communications kit**: Copy-ready launch announcements, an executive-sponsor variant, a tips drip campaign and FAQ answers for rolling Claude Code out to engineers.
  [Communications kit](https://code.claude.com/docs/en/communications-kit)
- **Champion kit**: A playbook for an engineer advocating Claude Code on their team: what to share, how to answer questions, a thirty-day plan and responses to common objections.
  [Champion kit](https://code.claude.com/docs/en/champion-kit)
