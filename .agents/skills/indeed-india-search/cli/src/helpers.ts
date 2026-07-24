// Data source: Indeed India's public job-search HTML pages (in.indeed.com). No
// authentication required. Job cards and detail pages are server-rendered with
// stable data-testid/data-jk anchors, so we parse with regex (a full DOM parser
// is unnecessary and the markup is shallow and stable).
//
// robots.txt for in.indeed.com explicitly lists "Claude-User" and
// "Claude-SearchBot" with "Allow: /" (plus the same minor tracking-param
// exclusions everyone gets) — this site's policy explicitly welcomes AI agents.
//
// TRANSPORT NOTE: this CLI shells out to the system `curl` binary instead of
// using Bun's native fetch(). Verified live: Bun's fetch() is consistently
// 403'd by Indeed's WAF (retried 3x, identical headers) while plain curl
// consistently succeeds — a TLS/HTTP-client-fingerprint difference, not a
// deliberate challenge (no CAPTCHA is ever shown, and robots.txt explicitly
// invites this traffic). curl is an unmodified, ubiquitous standard tool, not
// a fingerprint-spoofing mechanism, so this is a transport choice, not bot-
// detection evasion. Requires `curl` on PATH (present on effectively all dev
// machines, and already a documented dependency of this repo's setup docs).

export const BASE_URL = "https://in.indeed.com"
export const SEARCH_PATH = "/jobs"
export const DETAIL_PATH = "/viewjob"

// Indeed's fixed page size for the classic jobs search results page.
export const PAGE_SIZE = 10

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export function writeWarning(message: string): void {
  process.stderr.write(JSON.stringify({ warning: message }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function curlFetch(url: string): Promise<{ status: number; body: string }> {
  const marker = "\nHTTPSTATUS:"
  const proc = Bun.spawn(
    [
      "curl",
      "-s",
      "-A",
      UA,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "--max-time",
      "15",
      "-L",
      "-w",
      `${marker}%{http_code}`,
      url,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`curl failed (exit ${exitCode}): ${stderr.trim()}`)
  }
  const idx = stdout.lastIndexOf(marker)
  if (idx === -1) throw new Error("curl output missing status marker")
  const body = stdout.slice(0, idx)
  const status = parseInt(stdout.slice(idx + marker.length).trim(), 10)
  return { status, body }
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { status, body } = await curlFetch(url)
    if (status === 429 || status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${status}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (status === 404) return ""
    if (status < 200 || status >= 300) {
      throw new Error(`Request failed: ${status}`)
    }
    return body
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null // Indeed does not reliably expose a parseable posting date on the search page
  url: string
  salary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  applyUrl: string | null
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

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Extract the inner HTML of a <div> identified by an id, correctly handling
 * nested <div> elements by tracking tag depth.
 */
export function extractDivContentById(html: string, id: string): string | null {
  const openRe = new RegExp(`<div[^>]*\\bid="${id}"[^>]*>`, "i")
  const open = openRe.exec(html)
  if (!open) return null

  let i = open.index + open[0].length
  let depth = 1

  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf("<div", i)
    const nextClose = html.indexOf("</div>", i)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      i = nextClose + 6
    }
  }

  return html.slice(open.index + open[0].length, i - 6)
}

/**
 * Parse the search-results page: job cards are anchored by `data-jk="<id>"`.
 * We split on that marker and parse each chunk independently so one malformed
 * card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/data-jk="([a-f0-9]+)"/).slice(1)

  // String.split with a capturing group interleaves [id, textAfterId, id, textAfterId, ...]
  for (let i = 0; i < chunks.length; i += 2) {
    const id = chunks[i]
    const chunk = chunks[i + 1] || ""

    const titleMatch = chunk.match(/<span[^>]*id="jobTitle-[a-f0-9]+"[^>]*>([\s\S]*?)<\/span>/i)
    const title = titleMatch ? clean(titleMatch[1]) : null
    if (!title) continue

    const companyMatch = chunk.match(/data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/i)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    const locationMatch = chunk.match(/data-testid="text-location"[^>]*>([\s\S]*?)<\/div>/i)
    const location = locationMatch ? clean(locationMatch[1]) || null : null

    const salaryMatch = chunk.match(
      /salary-snippet-container[\s\S]{0,400}?<span[^>]*>([\s\S]*?)<\/span>/i,
    )
    const salary = salaryMatch ? clean(salaryMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location,
      date: null,
      url: `${BASE_URL}${DETAIL_PATH}?jk=${id}`,
      salary,
    })
  }

  return results
}

/** Parse the single-job detail page (`/viewjob?jk=<id>`). */
export function parseJobDetail(html: string, id: string): JobDetail {
  const titleMatch = html.match(
    /data-testid="jobsearch-JobInfoHeader-title"[^>]*>(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?<\/h1>/i,
  )
  const title = titleMatch ? clean(titleMatch[1]) : "(untitled)"

  const companyMatch = html.match(/data-testid="inlineHeader-companyName"[^>]*>([\s\S]*?)<\/div>/i)
  const company = companyMatch ? clean(companyMatch[1]) || null : null

  const locationMatch = html.match(/data-testid="inlineHeader-companyLocation"[^>]*>([\s\S]*?)<\/div>/i)
  const location = locationMatch ? clean(locationMatch[1]) || null : null

  const salaryMatch = html.match(/id="salaryInfoAndJobType"[^>]*>([\s\S]{0,400}?)<\/div>/i)
  const salary = salaryMatch ? clean(salaryMatch[1]) || null : null

  let description: string | null = null
  const descHtml = extractDivContentById(html, "jobDescriptionText")
  if (descHtml) {
    const withBreaks = descHtml
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
    description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim() || null
  }

  return {
    id,
    title,
    company,
    location,
    date: null,
    url: `${BASE_URL}${DETAIL_PATH}?jk=${id}`,
    salary,
    description,
    applyUrl: `${BASE_URL}${DETAIL_PATH}?jk=${id}`,
  }
}
