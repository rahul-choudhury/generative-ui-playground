/**
 * Finds a photo for show_recipe on Wikipedia/Wikimedia Commons: no key
 * needed. Photos carry their own licences (often CC BY-SA), so each comes
 * with its author and licence for the card to credit.
 *
 * Search the dish → take the first of the top results that is actually
 * food (by its Wikipedia short description, so "Paris" can't supply a photo
 * for a dish named after it) → its lead image → that file's attribution.
 * No suitable photo isn't an error: the card just has none.
 */
import { z } from "zod"
import { recipeResultSchema, type RecipeArgs, type RecipeResult } from "../../widgets/recipe/definition"
import { ResolveError } from "./resolve-error"

// Wikimedia asks API clients to identify themselves. Without contact details
// they're limited to 10 requests/minute across all of Wikimedia; with them
// (WIKIMEDIA_CONTACT: an email or URL), 200. So lookups are kept to ~2
// requests per dish, and results are cached.
// https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
const CONTACT = process.env.WIKIMEDIA_CONTACT
const USER_AGENT = `generative-ui-playground/0.1 (${CONTACT ? CONTACT : "local development"})`
const SEARCH_URL = "https://en.wikipedia.org/w/api.php"
const SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/"
const COMMONS_URL = "https://commons.wikimedia.org/w/api.php"

/** Wikimedia serves fixed thumbnail sizes; 960px suits a card banner. */
const IMAGE_WIDTH = 960

const FOOD =
  /\b(dish|food|cuisine|recipe|meal|snack|dessert|cake|cookie|biscuit|bread|pastry|pie|tart|soup|stew|curry|salad|sauce|dip|noodles?|pasta|rice|sandwich|drink|beverage|cocktail|confection(ery)?|pudding|porridge|dumplings?|omelette|pancakes?|condiment|delicacy|stir-fr(y|ied)|fried|baked|roasted|grilled)\b/i

const searchResponse = z.object({ query: z.object({ search: z.array(z.object({ title: z.string() })) }) })
const summaryResponse = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.string(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
  thumbnail: z.object({ source: z.string(), width: z.number(), height: z.number() }).optional(),
  originalimage: z.object({ source: z.string(), width: z.number(), height: z.number() }).optional(),
})
const metadataField = z.object({ value: z.string() }).optional()
const commonsResponse = z.object({
  query: z.object({
    pages: z.record(
      z.string(),
      z.object({
        imageinfo: z
          .array(
            z.object({
              descriptionurl: z.string().optional(),
              extmetadata: z
                .object({ Artist: metadataField, LicenseShortName: metadataField, LicenseUrl: metadataField })
                .optional(),
            })
          )
          .optional(),
      })
    ),
  }),
})

type Options = { fetch?: typeof fetch; now?: () => number; ttlMs?: number; timeoutMs?: number }

export function createRecipeResolver({
  fetch: fetchImpl = fetch,
  now = Date.now,
  ttlMs = 60 * 60_000, // photos of a dish don't change: cache for an hour
  timeoutMs = 6_000,
}: Options = {}) {
  const cache = new Map<string, { at: number; value: Promise<RecipeResult> }>()

  /** JSON, or null for a 404. Anything else failing is a service problem. */
  async function getJson<T>(url: URL, schema: z.ZodType<T>, signal: AbortSignal): Promise<T | null> {
    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new ResolveError("Couldn't reach Wikipedia for a photo.")
    }
    if (response.status === 404) return null
    if (!response.ok) throw new ResolveError("Couldn't reach Wikipedia for a photo.")
    const parsed = schema.safeParse(await response.json().catch(() => null))
    return parsed.success ? parsed.data : null
  }

  /** A food article's lead image as a result, or null if it isn't one. */
  async function photoFromArticle(title: string, signal: AbortSignal): Promise<RecipeResult | null> {
    const summary = await getJson(new URL(SUMMARY_URL + encodeURIComponent(title)), summaryResponse, signal)
    const original = summary?.originalimage
    if (!summary || summary.type !== "standard" || !original || !summary.thumbnail) return null
    if (!FOOD.test(summary.description ?? "")) return null // e.g. a city that shares the dish's name

    // Small originals are used as-is; larger ones as the 960px thumbnail.
    const useOriginal = original.width <= IMAGE_WIDTH
    const url = useOriginal ? original.source : summary.thumbnail.source.replace(/\/\d+px-/, `/${IMAGE_WIDTH}px-`)
    return recipeResultSchema.parse({
      image: {
        url,
        width: useOriginal ? original.width : IMAGE_WIDTH,
        height: useOriginal ? original.height : Math.round((original.height / original.width) * IMAGE_WIDTH),
        article: {
          title: summary.title,
          url: summary.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        },
        credit: await creditFor(original.source, signal),
      },
    })
  }

  async function findPhoto(args: RecipeArgs, signal: AbortSignal): Promise<RecipeResult> {
    // Most dishes are an article title as named ("Pad thai"): 2 requests.
    const direct = await photoFromArticle(args.dish, signal)
    if (direct) return direct

    // Otherwise search (spellings, plurals: "Shakshuka" → "Shakshouka").
    const searchUrl = new URL(SEARCH_URL)
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: args.dish,
      srlimit: "2",
      format: "json",
    }).toString()
    const titles = (await getJson(searchUrl, searchResponse, signal))?.query.search.map((r) => r.title) ?? []
    for (const title of titles) {
      if (title.toLowerCase() === args.dish.toLowerCase()) continue // already tried
      const found = await photoFromArticle(title, signal)
      if (found) return found
    }
    return { image: null }
  }

  /** Author and licence of the file behind an image URL, from Commons. */
  async function creditFor(imageUrl: string, signal: AbortSignal) {
    const fileName = decodeURIComponent(new URL(imageUrl).pathname.split("/").pop() ?? "")
    const filePage = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`
    const url = new URL(COMMONS_URL)
    url.search = new URLSearchParams({
      action: "query",
      titles: `File:${fileName}`,
      prop: "imageinfo",
      iiprop: "extmetadata|url",
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
      format: "json",
    }).toString()

    const info = Object.values((await getJson(url, commonsResponse, signal))?.query.pages ?? {})[0]?.imageinfo?.[0]
    const meta = info?.extmetadata
    // No licence, no photo: the licence terms require crediting it. (When
    // rate-limited, the API can answer 200 with an error body, which lands
    // here as missing metadata.) Failing isn't cached, so it's retried later.
    if (!meta?.LicenseShortName?.value) throw new ResolveError("Couldn't get the photo's licence details.")
    const licenseUrl = meta?.LicenseUrl?.value
    return {
      // Artist is HTML (usually a link to the user page): keep its text.
      author: meta?.Artist ? stripHtml(meta.Artist.value) || null : null,
      license: meta?.LicenseShortName?.value ?? null,
      // Sometimes protocol-relative ("//creativecommons.org/…").
      licenseUrl: licenseUrl ? absoluteUrl(licenseUrl) : null,
      fileUrl: info?.descriptionurl ?? filePage,
    }
  }

  return function resolveRecipe(args: RecipeArgs, signal: AbortSignal): Promise<RecipeResult> {
    const key = args.dish.toLowerCase()
    const hit = cache.get(key)
    if (hit && now() - hit.at < ttlMs) return hit.value

    const value = findPhoto(args, signal)
    cache.set(key, { at: now(), value })
    value.catch(() => cache.delete(key)) // never cache a failure
    return value
  }
}

function absoluteUrl(url: string): string | null {
  try {
    return new URL(url.startsWith("//") ? `https:${url}` : url).toString()
  } catch {
    return null
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export const resolveRecipe = createRecipeResolver()
