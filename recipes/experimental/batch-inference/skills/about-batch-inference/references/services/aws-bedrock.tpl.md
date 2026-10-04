# AWS Bedrock

> **EXPERIMENTAL.** From a research report written 2026-10-02; nothing here was tested with a live
> AWS account. Check AWS's own pages before relying on any number.

Bedrock serves many providers' models (Anthropic Claude, Amazon Nova, Meta Llama, Mistral,
DeepSeek, Qwen, OpenAI and others) through an AWS account, billed per token on the AWS bill.

- **Claude prices** match Anthropic's own list price through "Global" cross-region routing; routing
  that stays in the US costs 10 percent more. Global routing may process requests outside the US.
- **Limits of the newest Claude models** (Opus 5.5, Sonnet 5.5) on Bedrock: no batch discount, no
  native structured output, and they refuse a forced tool call, the usual way to force JSON. Scripts
  must validate the JSON themselves and retry.
- **Batch:** 50 percent off for many other models, including most open-weight ones.
- **Data handling:** by default Bedrock keeps no prompts or outputs, does not share them with model
  makers and does not train on them; request logging is off unless turned on. A per-Region
  retention setting of "none" blocks the few models that keep prompts (for example Claude Fable and
  some OpenAI models keep them up to 30 days).
- **Setup:** model access is granted automatically on first use, but Claude needs a one-time
  use-case form per account, plus some first-use AWS Marketplace permissions. Calls can use the AWS
  SDK for JavaScript or the Vercel AI SDK's Bedrock provider.
- **Quotas:** published defaults are high, but brand-new accounts often get very low limits in
  practice. Check Service Quotas before a large run.
- **Credits:** AWS credits may not cover Claude, which is billed through AWS Marketplace.
- **Not available:** Jev (TypeSafe AI), as of 2026-10-02.
