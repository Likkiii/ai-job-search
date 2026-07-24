// Data source: Instahyre's public "/api/v1/job_search" and
// "/api/v1/employer_public_jobs/<id>" JSON endpoints. No authentication required
// to read them, but the search endpoint does NOT honor query/location filter
// params for anonymous requests — it always returns the same paginated "curated
// opportunities" feed (~35 results/page) regardless of what's passed. Real
// personalized/filtered search only works for logged-in candidates.
//
// To still provide useful --query/--location filtering, this CLI scans multiple
// pages of the anonymous feed and filters client-side (see search.ts). This is
// slower and less exhaustive than a true server-side search — document this
// limitation to users.

export const SEARCH_URL = "https://www.instahyre.com/api/v1/job_search"
export const DETAIL_URL = "https://www.instahyre.com/api/v1/employer_public_jobs"
export const PUBLIC_BASE = "https://www.instahyre.com"

// Observed page size of the anonymous job_search feed (confirmed via live testing).
export const PAGE_SIZE = 35

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export function writeWarning(message: string): void {
  process.stderr.write(JSON.stringify({ warning: message }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  keywords: string[]
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  experience: string | null
  jobFunctions: string | null
  applyUrl: string | null
}

interface RawJobSearchObject {
  id: number
  title: string
  locations?: string
  public_url?: string
  keywords?: string[]
  employer?: { company_name?: string }
}

interface RawJobSearchResponse {
  objects: RawJobSearchObject[]
  meta?: { total_count?: number }
}

/** Fetch one page (offset-based) of Instahyre's anonymous job_search feed. */
export async function fetchSearchPage(offset: number): Promise<{ cards: JobCard[]; totalCount: number | null }> {
  const data = await jsonFetch<RawJobSearchResponse>(`${SEARCH_URL}?offset=${offset}`)
  if (!data) return { cards: [], totalCount: null }
  const cards: JobCard[] = (data.objects || []).map((o) => ({
    id: String(o.id),
    title: o.title,
    company: o.employer?.company_name ?? null,
    location: o.locations ?? null,
    date: null, // not exposed by the portal's public feed
    url: o.public_url ?? `${PUBLIC_BASE}/job-${o.id}`,
    keywords: o.keywords ?? [],
  }))
  return { cards, totalCount: data.meta?.total_count ?? null }
}

/** Case-insensitive substring match of `query` against title/keywords. */
export function matchesQuery(card: JobCard, query: string | undefined): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (card.title.toLowerCase().includes(q)) return true
  if (card.keywords.some((k) => k.toLowerCase().includes(q))) return true
  return false
}

/** Case-insensitive substring match of `location` against the card's locations string. */
export function matchesLocation(card: JobCard, location: string | undefined): boolean {
  if (!location) return true
  if (!card.location) return false
  return card.location.toLowerCase().includes(location.toLowerCase())
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/** Convert the API's embedded HTML description into readable plain text. */
export function htmlDescriptionToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
  const stripped = withBreaks.replace(/<[^>]+>/g, "")
  return decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

interface RawJobDetail {
  id: number
  title: string
  hiring_company_name?: string
  locations?: string[]
  description?: string
  is_internship?: boolean
  workex_min?: number
  workex_max?: number
  job_function_dict?: Record<string, string[]>
  opportunity_url?: string
  keywords?: string[]
}

/** Extract the numeric job ID from a raw ID, a full instahyre.com job URL, or a public_url path. */
export function normalizeId(input: string): string | null {
  const bare = input.match(/^\d+$/)
  if (bare) return input
  const url = input.match(/\/job-(\d+)-/)
  return url ? url[1] : null
}

export async function fetchJobDetail(id: string): Promise<JobDetail | null> {
  const data = await jsonFetch<RawJobDetail>(`${DETAIL_URL}/${id}`)
  if (!data) return null

  const functions = data.job_function_dict
    ? Object.entries(data.job_function_dict)
        .map(([category, subs]) => `${category}: ${subs.join(", ")}`)
        .join("; ")
    : null

  let experience: string | null = null
  if (data.workex_min !== undefined || data.workex_max !== undefined) {
    experience = `${data.workex_min ?? 0}-${data.workex_max ?? data.workex_min ?? 0} years`
  }

  const url = data.opportunity_url ? `${PUBLIC_BASE}${data.opportunity_url}` : `${PUBLIC_BASE}/job-${id}`

  return {
    id: String(data.id),
    title: data.title,
    company: data.hiring_company_name ?? null,
    location: data.locations ? data.locations.join(",") : null,
    date: null,
    url,
    keywords: data.keywords ?? [],
    description: data.description ? htmlDescriptionToText(data.description) : null,
    employmentType: data.is_internship ? "Internship" : "Full-time",
    experience,
    jobFunctions: functions,
    applyUrl: url,
  }
}
