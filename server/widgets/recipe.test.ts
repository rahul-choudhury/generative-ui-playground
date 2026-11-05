import { describe, expect, test } from "bun:test"
import type { RecipeArgs } from "../../widgets/recipe/definition"
import { ResolveError } from "./resolve-error"
import { commonsFileName, createRecipeResolver } from "./recipe"

// A real Commons imageinfo response (Shakshuka photo), saved so these tests
// never hit Wikimedia's rate limit.
const commonsFixture = await Bun.file(new URL("./fixtures/commons-imageinfo.json", import.meta.url)).text()

const args = (dish: string): RecipeArgs => ({
  dish,
  summary: null,
  servings: null,
  totalTime: null,
  ingredients: [{ quantity: null, item: "eggs" }],
  steps: ["Cook."],
  tip: null,
})

const article = (title: string, description: string, originalWidth = 3984) => ({
  type: "standard",
  title,
  description,
  content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title}` } },
  thumbnail: {
    source: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Shakshuka_by_Calliopejen1.jpg/330px-Shakshuka_by_Calliopejen1.jpg",
    width: 330,
    height: 248,
  },
  originalimage: {
    source: "https://upload.wikimedia.org/wikipedia/commons/1/18/Shakshuka_by_Calliopejen1.jpg",
    width: originalWidth,
    height: Math.round(originalWidth * 0.75),
  },
})

/**
 * Fake Wikimedia: `articles` by title (missing → 404), `search` results for
 * any query, Commons from the fixture (or `commons` override).
 */
function fakeWikimedia(opts: {
  articles?: Record<string, unknown>
  search?: string[]
  commons?: Response
  status?: number
}) {
  const requests: string[] = []
  const impl = (async (input: string | URL) => {
    const url = new URL(input)
    requests.push(`${url.host}${url.pathname}${url.searchParams.get("list") ? "?search" : ""}`)
    if (opts.status) return new Response("slow down", { status: opts.status })
    if (url.host.startsWith("commons")) return opts.commons ?? new Response(commonsFixture)
    if (url.pathname.startsWith("/w/api.php")) {
      return Response.json({ query: { search: (opts.search ?? []).map((title) => ({ title })) } })
    }
    const title = decodeURIComponent(url.pathname.split("/").pop()!)
    const found = opts.articles?.[title]
    return found ? Response.json(found) : new Response("not found", { status: 404 })
  }) as typeof fetch
  return { impl, requests }
}

const signal = () => new AbortController().signal

describe("recipe photo resolver", () => {
  test("a dish that is an article title: two requests, 960px image, full credit", async () => {
    const { impl, requests } = fakeWikimedia({ articles: { Shakshouka: article("Shakshouka", "Maghrebi dish of eggs") } })
    const { image } = await createRecipeResolver({ fetch: impl })(args("Shakshouka"), signal())

    expect(image).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Shakshuka_by_Calliopejen1.jpg/960px-Shakshuka_by_Calliopejen1.jpg",
      width: 960,
      height: 720,
      article: { title: "Shakshouka", url: "https://en.wikipedia.org/wiki/Shakshouka" },
      credit: {
        author: "Calliopejen1", // from the Artist HTML link
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
        fileUrl: "https://commons.wikimedia.org/wiki/File:Shakshuka_by_Calliopejen1.jpg",
      },
    })
    expect(requests).toHaveLength(2) // summary + commons, no search
  })

  test("small originals are used as-is (Wikimedia can't upscale)", async () => {
    const { impl } = fakeWikimedia({ articles: { Cookie: article("Cookie", "Baked sweet food", 800) } })
    const { image } = await createRecipeResolver({ fetch: impl })(args("Cookie"), signal())
    expect(image?.url).toBe("https://upload.wikimedia.org/wikipedia/commons/1/18/Shakshuka_by_Calliopejen1.jpg")
    expect(image?.width).toBe(800)
  })

  test("a different spelling falls back to search", async () => {
    const { impl, requests } = fakeWikimedia({
      search: ["Shakshouka"],
      articles: { Shakshouka: article("Shakshouka", "Maghrebi dish of eggs") },
    })
    const { image } = await createRecipeResolver({ fetch: impl })(args("Shakshuka"), signal())
    expect(image?.article.title).toBe("Shakshouka")
    expect(requests).toEqual([
      "en.wikipedia.org/api/rest_v1/page/summary/Shakshuka", // 404
      "en.wikipedia.org/w/api.php?search",
      "en.wikipedia.org/api/rest_v1/page/summary/Shakshouka",
      "commons.wikimedia.org/w/api.php",
    ])
  })

  test("non-food articles never supply a photo", async () => {
    const { impl } = fakeWikimedia({
      search: ["Paris"],
      articles: { Paris: article("Paris", "Capital and largest city of France") },
    })
    expect(await createRecipeResolver({ fetch: impl })(args("Paris"), signal())).toEqual({ image: null })
  })

  test("nothing found is no photo, not an error", async () => {
    const { impl } = fakeWikimedia({ search: [] })
    expect(await createRecipeResolver({ fetch: impl })(args("Grandma's lasagna"), signal())).toEqual({ image: null })
  })

  test("no licence, no photo: missing credit fails the lookup", async () => {
    // The Action API can answer a rate limit with 200 and an error body.
    const { impl } = fakeWikimedia({
      articles: { Shakshouka: article("Shakshouka", "Maghrebi dish of eggs") },
      commons: Response.json({ error: { code: "ratelimited" } }),
    })
    const error = await createRecipeResolver({ fetch: impl })(args("Shakshouka"), signal()).catch((e) => e)
    expect(error).toBeInstanceOf(ResolveError)
  })

  test("rate limiting is a (retryable) failure, and failures aren't cached", async () => {
    let status: number | undefined = 429
    const real = fakeWikimedia({ articles: { Shakshouka: article("Shakshouka", "Maghrebi dish of eggs") } })
    const limited = fakeWikimedia({ status: 429 })
    const impl = ((input: string | URL, init?: RequestInit) =>
      (status ? limited.impl : real.impl)(input, init)) as typeof fetch
    const resolve = createRecipeResolver({ fetch: impl })

    expect(await resolve(args("Shakshouka"), signal()).catch((e) => e)).toBeInstanceOf(ResolveError)
    status = undefined
    expect((await resolve(args("Shakshouka"), signal())).image?.article.title).toBe("Shakshouka")
  })

  test("found photos are cached per dish", async () => {
    const { impl, requests } = fakeWikimedia({ articles: { Shakshouka: article("Shakshouka", "Maghrebi dish of eggs") } })
    const resolve = createRecipeResolver({ fetch: impl })
    await resolve(args("Shakshouka"), signal())
    await resolve(args("shakshouka"), signal())
    expect(requests).toHaveLength(2)
  })
})

describe("commonsFileName", () => {
  test("a plain original: the last segment", () => {
    expect(commonsFileName("https://upload.wikimedia.org/wikipedia/commons/1/18/Shakshuka_by_Calliopejen1.jpg")).toBe(
      "Shakshuka_by_Calliopejen1.jpg"
    )
  })

  test("a very large 'original' is a thumbnail: the segment before the size", () => {
    // Real case: the Okonomiyaki article's originalimage.
    expect(
      commonsFileName(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Okonomiyaki_001.jpg/3840px-Okonomiyaki_001.jpg"
      )
    ).toBe("Okonomiyaki_001.jpg")
  })

  test("encoded names are decoded", () => {
    expect(commonsFileName("https://upload.wikimedia.org/wikipedia/commons/a/ab/Cr%C3%AApe.jpg")).toBe("Crêpe.jpg")
  })
})
