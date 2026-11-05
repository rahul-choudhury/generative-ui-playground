import { Hono } from "hono"
import { stream } from "hono/streaming"
import { ChatRequestSchema } from "../shared/protocol"
import { streamChat } from "./llm/stream"

const app = new Hono()

app.post("/api/chat", async (c) => {
  const parsed = ChatRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400)
  }

  c.header("Content-Type", "application/x-ndjson; charset=utf-8")
  c.header("Cache-Control", "no-cache")

  // Fires when the client disconnects (e.g. the Stop button), which aborts
  // the OpenAI request too.
  const signal = c.req.raw.signal

  return stream(c, async (s) => {
    for await (const event of streamChat(parsed.data.messages, signal)) {
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
