# Tradeoffs

- **Raw OpenAI SDK, not the Vercel AI SDK.** Every streaming and tool-call mechanic is visible. Costs hand-written stream translation and history mapping.
- **Stateless server (full history every request).** Simple, and models can be switched mid-conversation. Costs larger requests every turn, mostly offset by prompt caching.
- **Own provider-neutral stream protocol.** The client never changes with the provider. Costs a translation layer in `server/llm/`.
- **A widget call ends the reply; only data widgets get a second pass.** One request per turn for most widgets. Costs the model never writing after a widget, and an extra request for weather.
- **The second pass can't fetch again.** No loops. Costs no retry after a failed lookup.
- **OpenAI strict mode for tool arguments.** The arguments' shape is guaranteed. Costs every field being required (optional means nullable); refinements and non-blank checks are only enforced by Zod.
- **Widget interactions appended as events, never rewriting earlier tool outputs.** Keeps the prompt cache valid. Costs the model only hearing about ticks with the user's next message.
- **Critical rules enforced in code, not just descriptions.** Reliable. Costs behaviour that isn't visible in the widget descriptions.
- **Stopped replies not counted, prices maintained by hand.** Every shown cost is exact. Costs totals that undercount, and manual price updates.
- **Free, keyless data sources (Open-Meteo, anonymous Wikimedia).** No API keys or accounts. Costs non-commercial-only weather, city-only lookups (regions fail), and a 10 requests/minute photo limit.
- **No persistence.** Simple. Costs conversations and widget state disappearing on reload.
- **Evals with code-only checks and fixed data.** Cheap and deterministic. Costs brittle wording checks and live APIs going untested by evals.
- **Luna as the default model, with a known ~7% checklist miss.** 1/20 of Sol's cost. Costs occasional prose where a checklist was asked for; Terra and Sol don't miss it.
