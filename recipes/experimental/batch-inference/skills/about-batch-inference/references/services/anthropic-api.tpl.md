# The Anthropic API

> **EXPERIMENTAL.** Notes from one experiment, read 2026-10. Prices and limits change; check the
> provider's own pages before relying on any number here.

The Anthropic API serves Claude models directly, billed per token.

- **Keys:** created at https://platform.claude.com/settings/keys (the older
  console.anthropic.com address redirects there). Scripts read the key from `ANTHROPIC_API_KEY`.
- **Billing:** prepaid credits. With none left, every call fails with "Your credit balance is too
  low to access the Anthropic API", so add credits before a run, not during it.
- **Prices** (2026-10-02, per million tokens, input / output): Opus 5.5 USD 4 / 20, Sonnet 5.5
  USD 2 / 10. Fable's price was not recorded.
- **Batch API:** asynchronous batches at half the standard price (reported by a gateway's
  documentation, 2026-10). Worth it for a full run once prompts are final; the tuning runs in this
  experiment used ordinary calls because they needed answers within seconds.
- **Structured output:** `output_config: { format: { type: "json_schema", schema } }` on a Messages
  request returned valid JSON from Opus 5.5, Sonnet 5.5 and Fable 5.1 in this experiment. Keep a
  fallback that asks for JSON in the text and parses it, for models or providers that refuse the
  parameter.
- **Listing models:** `GET /v1/models` lists the model IDs the key can use; take IDs from there
  rather than from examples.
- **Throughput:** at this experiment's scale (a few dozen concurrent requests) no rate limit was
  hit.
