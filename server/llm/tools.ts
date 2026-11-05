/**
 * Widget registry → OpenAI function tools. The only place that knows
 * OpenAI's tool format; adding a widget needs no change here.
 *
 * strict: true makes OpenAI guarantee the arguments match the schema's shape
 * (every field present, no extras). Zod's JSON Schema output already uses
 * required + additionalProperties: false, which strict mode needs.
 */
import type { FunctionTool } from "openai/resources/responses/responses"
import { z } from "zod"
import type { WidgetDefinition } from "../../widgets/define"
import { definitions } from "../../widgets/definitions"

function toOpenAITool(widget: WidgetDefinition): FunctionTool {
  return {
    type: "function",
    name: widget.name,
    description: widget.description,
    parameters: z.toJSONSchema(widget.schema),
    strict: true,
  }
}

export const tools: FunctionTool[] = definitions.map(toOpenAITool)

/** The tools offered for one request, minus any that aren't allowed in it. */
export function toolsExcept(excluded: (name: string) => boolean): FunctionTool[] {
  return tools.filter((tool) => !excluded(tool.name))
}
