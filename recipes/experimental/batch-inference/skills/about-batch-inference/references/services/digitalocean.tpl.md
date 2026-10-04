# DigitalOcean Inference

> **EXPERIMENTAL.** From a research report written 2026-10-02, plus live use of its Jev endpoint.
> Check DigitalOcean's own pages before relying on any number.

DigitalOcean's "Inference" service (earlier names: GenAI Platform, Gradient AI Platform, AI
Platform) serves third-party models (Anthropic, OpenAI, TypeSafe AI's Jev) and open-weight models
it hosts itself, billed per token.

- **Endpoint:** `https://inference.do-ai.run`. It accepts OpenAI-style requests (Chat Completions
  and Responses) and Anthropic-style Messages requests, so the `openai` npm package works by
  changing its base URL. Jev has its own endpoint, `/v1/systemone`, which takes `state` plus typed
  `questions` and is not OpenAI-compatible.
- **Keys:** a model access key, created in the control panel under the inference service's
  "Model Access Keys". Its scope (which models, whether batch is allowed) cannot be changed later.
- **Billing:** prepaid since mid-2026. A balance is topped up (the documentation names USD 5 as
  the smallest top-up) and requests stop at zero;
  auto-reload is switched on by default when funds are added.
- **Account tier:** DigitalOcean's documentation (2026-10-02) said Anthropic models, and OpenAI
  models other than the open-weight ones, need account Tier 3, reached by a one-time USD 250
  prepayment or after enough paid invoices. In practice, one user who prepaid USD 100, with no
  minimum stated, could use Jev at once; whether Anthropic models would then ask for more was not
  tested. Check the account's Resource Limits page before relying on either.
- **Prices** (2026-10-02): Anthropic and OpenAI models at their makers' list prices. Open-weight
  models it hosts are cheap, for example about USD 0.14 / 0.28 per million input / output tokens for
  a small DeepSeek model. Jev: USD 0.042 per million input tokens, output free.
- **Batch:** up to 50 percent off, for Anthropic and OpenAI models only.
- **Data handling:** DigitalOcean says it stores no inputs or outputs and does not train on them,
  and prompts to models it hosts never reach their makers. Its terms allow scanning content and
  keeping it during a violation investigation, and batch files are kept about 30 days. Requests to
  Jev pass through to TypeSafe AI under TypeSafe's terms.
- **Caveats:** the documentation contradicts itself in places (structured output for third-party
  models, batch retention), some example model IDs no longer exist (list them from `/v1/models`),
  and a rate-limiting incident in April 2026 suggests scripts need retries.
