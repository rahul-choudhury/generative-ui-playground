import { Hono } from "hono"
import { stream } from "hono/streaming"
import { ChatRequestSchema, type ModelsResponse } from "../shared/protocol"
import { isSelectableModel, listModels } from "./llm/models"
import { model as defaultModel } from "./llm/openai"
import { streamChat } from "./llm/stream"

// The default must be selectable: the browser falls back to it and sends it
// with every message, and /api/chat only accepts models from the price
// table. An unpriced default would make every message fail with a 400, so
// fail here at startup instead, with the fix in the message.
if (!isSelectableModel(defaultModel)) {
  const known = listModels().map((m) => m.id).join(", ")
  throw new Error(
    `OPENAI_MODEL is "${defaultModel}", which has no prices in server/llm/models.ts. ` +
      `Add its prices there, or set OPENAI_MODEL to one of: ${known}.`
  )
}

const app = new Hono()

/** What the model selector offers: priced models, and the server default. */
app.get("/api/models", (c) => c.json({ models: listModels(), default: defaultModel } satisfies ModelsResponse))

app.post("/api/chat", async (c) => {
  const parsed = ChatRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400)
  }

  // The client may only pick from the list above: a model name from the
  // browser is never passed to OpenAI unchecked.
  const { messages, model } = parsed.data
  if (model !== undefined && !isSelectableModel(model)) {
    return c.json({ error: `Unknown model "${model}"` }, 400)
  }

  c.header("Content-Type", "application/x-ndjson; charset=utf-8")
  c.header("Cache-Control", "no-cache")

  // Fires when the client disconnects (e.g. the Stop button), which aborts
  // the OpenAI request too.
  const signal = c.req.raw.signal

  return stream(c, async (s) => {
    for await (const event of streamChat(messages, signal, { model })) {
      await s.write(JSON.stringify(event) + "\n")
    }
  })
})

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
  // Bun closes connections idle for 10s by default. Reasoning models can
  // think silently for longer than that before the first token arrives.
  idleTimeout: 255,
}
