/**
 * Parses the start of a JSON document that is still streaming in, returning
 * the most complete value it implies:
 *
 *   {"title":"Tok                → { title: "Tok" }
 *   {"items":[{"label":"Pass     → { items: [{ label: "Pass" }] }
 *   {"title":"Tokyo","it         → { title: "Tokyo" }     (half a key: dropped)
 *   {"done":tr                   → {}                     (half a literal: dropped)
 *
 * How: scan once, tracking open objects/arrays and where we are inside each
 * (expecting a key, a colon, a value, or a comma). Every point where the
 * document could be cleanly closed is remembered along with the closers it
 * needs. At the end, either finish the string value we're in the middle of
 * (so text appears as it's typed) or cut back to the last clean point, then
 * append the closers and JSON.parse.
 *
 * Returns undefined when nothing usable has arrived yet.
 */

type Frame = { type: "object" | "array"; state: "key" | "colon" | "value" | "comma" }

const closersFor = (stack: Frame[]) =>
  stack
    .map((frame) => (frame.type === "object" ? "}" : "]"))
    .reverse()
    .join("")

export function parsePartialJson(text: string): unknown {
  const stack: Frame[] = []
  let safe: { end: number; closers: string } | null = null
  const markSafe = (end: number) => {
    safe = { end, closers: closersFor(stack) }
  }

  // A complete value just ended: the enclosing container now wants a comma.
  const valueDone = (end: number) => {
    const top = stack.at(-1)
    if (top) top.state = "comma"
    markSafe(end)
  }

  let inString = false
  let stringIsKey = false
  let escaped = false // the previous char was an unescaped backslash
  let unicodeStart = -1 // index of the backslash of a \uXXXX still being read

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!

    if (inString) {
      if (unicodeStart >= 0) {
        if (i === unicodeStart + 5) unicodeStart = -1 // read all 4 hex digits
        continue
      }
      if (escaped) {
        escaped = false
        if (char === "u") unicodeStart = i - 1
      } else if (char === "\\") escaped = true
      else if (char === '"') {
        inString = false
        if (stringIsKey) stack.at(-1)!.state = "colon"
        else valueDone(i + 1)
      }
      continue
    }

    switch (char) {
      case " ":
      case "\n":
      case "\r":
      case "\t":
        break
      case "{":
        stack.push({ type: "object", state: "key" })
        markSafe(i + 1) // "{" alone closes to "{}"
        break
      case "[":
        stack.push({ type: "array", state: "value" })
        markSafe(i + 1)
        break
      case "}":
      case "]":
        stack.pop()
        valueDone(i + 1)
        break
      case '"': {
        const top = stack.at(-1)
        inString = true
        stringIsKey = top?.type === "object" && top.state === "key"
        break
      }
      case ":":
        stack.at(-1)!.state = "value"
        break
      case ",": {
        const top = stack.at(-1)!
        top.state = top.type === "object" ? "key" : "value"
        break
      }
      default: {
        // A number or literal (true/false/null). It's only complete once a
        // delimiter follows; a half-typed one is cut off.
        let end = i
        while (end < text.length && !/[\s,\]}]/.test(text[end]!)) end++
        if (end === text.length) {
          i = end
          break
        }
        valueDone(end)
        i = end - 1
      }
    }
  }

  let candidate: string
  if (inString && !stringIsKey) {
    // Mid-way through a string value: close it, so text shows as it types.
    // Drop a dangling backslash or half a \u escape, which can't be closed.
    // (The scanner knows which: a regex can't tell `\` from an escaped `\\`.)
    const body =
      unicodeStart >= 0 ? text.slice(0, unicodeStart) : escaped ? text.slice(0, -1) : text
    candidate = body + '"' + closersFor(stack)
  } else if (safe) {
    const { end, closers } = safe as { end: number; closers: string }
    candidate = text.slice(0, end) + closers
  } else {
    return undefined
  }

  try {
    return JSON.parse(candidate)
  } catch {
    return undefined
  }
}
