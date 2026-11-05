# CLAUDE.md

A generative UI chat playground. Instead of answering only in Markdown, the model can call **widgets** (tools such as a checklist, weather card or recipe) that render as interactive components. Data widgets get facts fetched by the server; user interactions flow back to the model.

Stack: React + Vite client, Hono on Bun server, OpenAI Responses API via the raw SDK (not the AI SDK). UI is built on the user's own component library, `@rahul-choudhury/ui`: use its components and tokens rather than raw styles.

## Commands

- `bun run dev`: Vite client + Hono server
- `bun run typecheck` and `bun test`: run both after changes
- `bun run evals [--runs N] [--filter text]`: real-model evals, costs money. Run after ANY change to a widget description, schema or system prompt; use `--runs 3+` because results vary per run

## Rules that aren't obvious from the code

- **Adding a widget**: register it in both `widgets/definitions.ts` and `widgets/components.ts` (plus `server/widgets/resolvers.ts` if it fetches data), and add eval cases, including ones where it should NOT be used.
- **Tool schemas use OpenAI strict mode**: every field is required, so "optional" means `.nullable()`. Strict mode does not enforce `.refine()` or non-blank strings; use `text()` from `widgets/define.ts`, and rely on Zod validation for the rest.
- **History must stay append-only**: never rewrite an earlier `function_call_output` (it breaks prompt caching). Widget interaction reaches the model as `<widget_events>` notes on the next user message.
- **Tune model behaviour with evals, not intuition**: fixes in one description often regress other cases. Rules that must hold are enforced in code (see tool exclusion in `server/llm/stream.ts`).
- **Only `server/llm/` knows OpenAI**; the client/server protocol in `shared/protocol.ts` is provider-neutral. Keep it that way.
- **Prices are hand-maintained** in `server/llm/models.ts`; the server refuses to start if `OPENAI_MODEL` isn't priced there.
- **Wikimedia (recipe photos) allows ~10 requests/min anonymously**: don't hit it in tests; use fakes and `server/widgets/fixtures/`.
- `*.md` is gitignored; add a Markdown file deliberately with `git add -f`.
