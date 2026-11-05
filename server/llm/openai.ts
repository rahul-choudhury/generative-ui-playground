import OpenAI from "openai"

export const openai = new OpenAI() // reads OPENAI_API_KEY from the environment

export const model = process.env.OPENAI_MODEL ?? "gpt-6-luna"
