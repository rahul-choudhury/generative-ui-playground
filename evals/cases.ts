/**
 * What the model should do, prompt by prompt. Each case is a short scripted
 * conversation with expectations per turn. Add cases with every widget, and
 * especially cases where a widget should NOT be used.
 */
import { args, conversation, noWidget, notUses, onlyFrom, requests, resultStatus, text, textBefore, textNot, uses } from "./checks"
import { NOT_A_PLACE } from "./fixed-data"
import { lastWidget, type Case } from "./harness"

type ChecklistArgs = { title: string; items: { label: string; checked: boolean }[] }
type FactCardArgs = { facts: { label: string; value: string }[] }
type ChoicesArgs = { options: { label: string }[] }
type WeatherArgs = { location: string; country: string | null; days: number; units: string }
type ComparisonArgs = { subjects: string[]; rows: { values: string[] }[] }
type StepsArgs = { steps: { when: string | null }[] }
type RecipeArgs = { ingredients: unknown[]; steps: unknown[] }

const words = (s: string) => s.trim().split(/\s+/).length

export const cases: Case[] = [
  // ─── Should use a widget ──────────────────────────────────────────────────
  {
    group: "should use",
    name: "packing list → checklist",
    turns: [
      {
        user: "Make me a packing list for a week in Lisbon.",
        expect: [uses("show_checklist"), args<ChecklistArgs>("show_checklist", "5+ items", (a) => a.items.length >= 5)],
      },
    ],
  },
  {
    group: "should use",
    name: "setup steps → checklist",
    // Tasks the user will do and tick off: a checklist, not a timeline.
    turns: [{ user: "What are the steps to set up a new Next.js app with Tailwind?", expect: [uses("show_checklist"), notUses("show_steps")] }],
  },
  {
    group: "should use",
    name: "single subject → fact card",
    turns: [{ user: "Tell me about Kyoto.", expect: [uses("show_fact_card")] }],
  },
  {
    group: "should use",
    name: "element facts → fact card",
    turns: [{ user: "Key facts about the planet Mars?", expect: [uses("show_fact_card")] }],
  },
  {
    group: "should use",
    name: "ambiguous request → one question",
    turns: [
      {
        user: "Help me pick a laptop.",
        expect: [uses("show_choices"), args<ChoicesArgs>("show_choices", "2–4 options", (a) => a.options.length >= 2 && a.options.length <= 4)],
      },
    ],
  },
  {
    group: "should use",
    name: "weather question → weather card",
    turns: [
      {
        user: "What's the weather in Oslo?",
        expect: [uses("show_weather"), onlyFrom("show_weather"), args<WeatherArgs>("show_weather", "location Oslo", (a) => /oslo/i.test(a.location)), resultStatus("show_weather", "ok")],
      },
    ],
  },

  // ─── Should NOT use a widget ──────────────────────────────────────────────
  {
    group: "should not use",
    name: "simple fact → plain text",
    turns: [{ user: "What's the capital of France?", expect: [noWidget(), text("naming Paris", /paris/i)] }],
  },
  {
    group: "should not use",
    name: "explanation → plain text",
    turns: [{ user: "Explain recursion with a short example.", expect: [noWidget()] }],
  },
  {
    group: "should not use",
    name: "small talk → plain text",
    turns: [{ user: "Thanks, that's all for now!", expect: [noWidget()] }],
  },
  {
    group: "should not use",
    name: "coding question → plain text",
    turns: [{ user: "Write a Python function that reverses a string.", expect: [noWidget(), text("with code", /def /)] }],
  },
  {
    group: "should not use",
    name: "opinion with a clear ask → no question",
    turns: [{ user: "Should I learn Python or JavaScript first? Just tell me which.", expect: [noWidget()] }],
  },
  {
    group: "should not use",
    name: "specific request → answer, no question",
    turns: [
      {
        user: "Recommend a laptop for 4K video editing under $2000. I prefer macOS.",
        expect: [notUses("show_choices")],
      },
    ],
  },

  // ─── Close calls ──────────────────────────────────────────────────────────
  {
    group: "close calls",
    name: "pack for a place → checklist (weather optional)",
    turns: [
      {
        user: "What should I pack for Oslo this weekend?",
        expect: [uses("show_checklist"), onlyFrom("show_checklist", "show_weather")],
      },
    ],
  },
  {
    group: "close calls",
    // Asking "what kind of trip?" with buttons is fine; what matters is that
    // it asks at most one question and nothing else is shown yet.
    name: "open-ended trip → at most one question",
    turns: [{ user: "Plan a weekend trip for me.", expect: [onlyFrom("show_choices")] }],
  },

  // ─── Past bugs ────────────────────────────────────────────────────────────
  {
    group: "past bugs",
    name: "asks at most one question, then answers",
    turns: [
      { user: "Help me pick a laptop.", expect: [uses("show_choices")] },
      {
        pick: 0,
        // No second question, as a widget (blocked in code) or in text.
        expect: [
          notUses("show_choices"),
          // A follow-up question after a real recommendation is fine; a reply
          // that is nothing but questions is not.
          conversation("a real answer, not only more questions", (turns) => {
            const statements = turns.at(-1)!.text.split(/(?<=[.!?])\s+/).filter((s) => !s.trim().endsWith("?"))
            return statements.join(" ").length >= 80
          }),
        ],
      },
    ],
  },
  {
    group: "past bugs",
    name: "advice + checklist → advice written first",
    turns: [
      {
        user: "I'm launching my app next week. Give me some advice and a launch checklist.",
        expect: [uses("show_checklist"), textBefore("show_checklist")],
      },
    ],
  },
  {
    group: "past bugs",
    name: "fact card values stay short",
    turns: [
      {
        user: "Tell me about Frida Kahlo.",
        expect: [
          uses("show_fact_card"),
          args<FactCardArgs>("show_fact_card", "every value ≤ 6 words", (a) => a.facts.every((f) => words(f.value) <= 6)),
        ],
      },
    ],
  },
  {
    group: "past bugs",
    name: "'tomorrow' uses tomorrow's forecast",
    turns: [
      {
        // Fixed data: today (Thu) 37%, tomorrow (Fri) 18% drizzle.
        user: "Should I bring an umbrella in London tomorrow?",
        expect: [uses("show_weather"), onlyFrom("show_weather"), text("describing tomorrow (Fri: drizzle, 18%)", /18\s?%|drizzl/i), textNot("describing today (Thu: 37%)", /37\s?%/)],
      },
    ],
  },
  {
    group: "past bugs",
    name: "day outside the fetch → fetch again, right day",
    turns: [
      {
        user: "What's the weather in London tomorrow? Just tomorrow.",
        expect: [uses("show_weather")],
      },
      {
        // Fixed data: the day after tomorrow (Sat) is 10%.
        user: "And the day after tomorrow? One sentence.",
        expect: [
          conversation("Saturday's data to be in some fetch", (turns) =>
            turns.some((t) => t.widgets.some((w) => w.name === "show_weather" && (w.args as WeatherArgs).days >= 3))
          ),
          // Saturday: overcast, 6–10°C, 10%. Friday (wrong day) was drizzle, 18%.
          text("describing Saturday", /overcast|10\s?%/i),
          textNot("describing Friday", /drizzl|18\s?%/i),
        ],
      },
    ],
  },
  {
    group: "past bugs",
    name: "unknown place → error, model asks",
    turns: [
      {
        user: `What's the weather like in ${NOT_A_PLACE}?`,
        expect: [uses("show_weather"), onlyFrom("show_weather"), resultStatus("show_weather", "error"), text("asking for clarification", /\?/)],
      },
    ],
  },

  // ─── Widget state ─────────────────────────────────────────────────────────
  {
    group: "widget state",
    name: "ticked items → knows what's left",
    turns: [
      {
        user: "Make a 5-item packing list for a beach weekend.",
        expect: [uses("show_checklist"), args<ChecklistArgs>("show_checklist", "exactly 5 items", (a) => a.items.length === 5)],
      },
      {
        tick: [0, 2],
        user: "What's left to pack? Just list the remaining items.",
        expect: [
          noWidget(),
          conversation("every unticked item, and no ticked one, named in the reply", (turns) => {
            const list = lastWidget(turns, "show_checklist")?.args as ChecklistArgs | undefined
            const reply = turns.at(-1)!.text.toLowerCase()
            if (!list) return false
            // Match on each label's first significant word, to allow rephrasing.
            const key = (label: string) => label.toLowerCase().match(/[a-z]{4,}/)?.[0] ?? label.toLowerCase()
            return list.items.every((item, i) => {
              const ticked = item.checked || [0, 2].includes(i)
              return reply.includes(key(item.label)) !== ticked
            })
          }),
        ],
      },
    ],
  },
  {
    group: "should use",
    name: "units follow the user",
    turns: [
      {
        user: "What's the temperature in Chicago right now? I'm in the US.",
        expect: [uses("show_weather"), onlyFrom("show_weather"), args<WeatherArgs>("show_weather", "fahrenheit", (a) => a.units === "fahrenheit")],
      },
    ],
  },

  // ─── Comparison ───────────────────────────────────────────────────────────
  {
    group: "comparison",
    name: "compare two places → comparison table",
    turns: [
      {
        user: "Compare Tokyo and Osaka for a first-time visitor.",
        expect: [
          uses("show_comparison"),
          notUses("show_fact_card"),
          args<ComparisonArgs>("show_comparison", "2 subjects, 3+ rows", (a) => a.subjects.length === 2 && a.rows.length >= 3),
        ],
      },
    ],
  },
  {
    group: "comparison",
    name: "'X vs Y' → comparison table",
    turns: [{ user: "Postgres vs MySQL for a small web app?", expect: [uses("show_comparison")] }],
  },
  {
    group: "comparison",
    name: "single fact about two things → plain text",
    turns: [{ user: "Which is bigger by population, Tokyo or Osaka? One line.", expect: [noWidget()] }],
  },

  // ─── Steps / timeline ─────────────────────────────────────────────────────
  {
    group: "steps",
    name: "itinerary → timeline, not checklist",
    turns: [
      {
        user: "Plan a 3-day itinerary for Rome.",
        expect: [
          uses("show_steps"),
          notUses("show_checklist"),
          args<StepsArgs>("show_steps", "time markers on every step", (a) => a.steps.every((s) => s.when)),
        ],
      },
    ],
  },
  {
    group: "steps",
    name: "how a process unfolds → timeline",
    turns: [{ user: "How does a bill become a law in the US?", expect: [uses("show_steps"), notUses("show_checklist")] }],
  },
  {
    group: "steps",
    name: "a history → timeline with dates",
    turns: [
      {
        user: "Give me a timeline of the Apollo 11 mission.",
        expect: [uses("show_steps"), args<StepsArgs>("show_steps", "dated steps", (a) => a.steps.every((s) => s.when))],
      },
    ],
  },

  // ─── Recipe ───────────────────────────────────────────────────────────────
  {
    group: "recipe",
    name: "how to make a dish → recipe, one request",
    turns: [
      {
        user: "How do I make pad thai?",
        expect: [
          uses("show_recipe"),
          args<RecipeArgs>("show_recipe", "4+ ingredients and 3+ steps", (a) => a.ingredients.length >= 4 && a.steps.length >= 3),
          resultStatus("show_recipe", "ok"),
          // The photo is decoration: no second pass, so one request.
          requests(1),
        ],
      },
    ],
  },
  {
    group: "recipe",
    name: "ask for a recipe → recipe",
    turns: [{ user: "Give me a recipe for chocolate chip cookies.", expect: [uses("show_recipe")] }],
  },
  {
    group: "recipe",
    name: "food history → plain text",
    turns: [{ user: "Where does pad thai come from? Two sentences.", expect: [noWidget()] }],
  },
  {
    group: "recipe",
    name: "dinner ideas → no recipe card",
    turns: [{ user: "Give me 5 ideas for a quick weeknight dinner.", expect: [notUses("show_recipe")] }],
  },
]
