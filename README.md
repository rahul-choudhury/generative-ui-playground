# Generative UI playground

A chat where the model can answer with interactive components instead of only Markdown: checklists, fact cards, comparison tables, timelines, choices, weather and recipes.

https://github.com/user-attachments/assets/c1ddef55-7924-484b-a855-98a6004d400b

## How it works

1. Each widget is a **tool** with a Zod schema. The model calls it, and its arguments stream to the client.
2. The client renders the widget **while the arguments stream in**, then validates them and shows the finished component.
3. **Data widgets** (weather, recipe photo) are filled in by the server. The model names a place; the server fetches the forecast and hands it back so the model can answer from real figures.
4. **Interactions** (ticking items, picking an option) go back to the model with the next message.

The server translates OpenAI's stream into its own provider-neutral NDJSON protocol, so the client doesn't know which model it's talking to.

## Stack

React + Vite · Hono on Bun · OpenAI Responses API · [@rahul-choudhury/ui](https://github.com/rahul-choudhury/ui)

## Run it

Put your key in `.env` (see `.env.example`; `OPENAI_MODEL` is optional), then:

```sh
bun install
bun run dev     # http://localhost:5173
```

```sh
bun test        # unit tests
bun run evals   # checks the model picks the right widgets (calls the real API, costs ~1¢)
```
