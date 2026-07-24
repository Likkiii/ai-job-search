import {
  PAGE_SIZE,
  fetchSearchPage,
  matchesQuery,
  matchesLocation,
  writeError,
  writeWarning,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// Instahyre's anonymous job_search feed ignores query/location filter params, so
// we scan multiple pages of the raw feed and filter client-side. This caps how
// many raw pages we'll fetch per invocation to keep a single `search` call fast.
const MAX_SCAN_PAGES = 40

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    return `${c.id.padEnd(9)} ${title} ${company} ${loc}`
  })
  const header =
    "ID".padEnd(9) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  if (opts.jobage !== undefined) {
    writeWarning(
      "Instahyre's public feed does not expose posting dates, so --jobage cannot filter by recency. Ignoring.",
    )
  }

  const resultsPerPage = opts.limit && opts.limit > 0 ? opts.limit : 10
  const needed = opts.page * resultsPerPage

  try {
    const matches: JobCard[] = []
    const seen = new Set<string>()
    let offset = 0
    let scannedPages = 0
    let totalCount: number | null = null

    while (scannedPages < MAX_SCAN_PAGES && matches.length < needed) {
      const { cards, totalCount: tc } = await fetchSearchPage(offset)
      if (tc !== null) totalCount = tc
      if (cards.length === 0) break // exhausted the feed

      for (const card of cards) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        if (matchesQuery(card, opts.query) && matchesLocation(card, opts.location)) {
          matches.push(card)
        }
      }

      offset += PAGE_SIZE
      scannedPages++
      if (totalCount !== null && offset >= totalCount) break
    }

    const pageResults = matches.slice((opts.page - 1) * resultsPerPage, opts.page * resultsPerPage)

    if (opts.format === "table") {
      process.stdout.write(renderTable(pageResults) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        pageResults
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: pageResults.length,
              page: opts.page,
              scannedRawPostings: scannedPages * PAGE_SIZE,
              totalRawPostings: totalCount,
            },
            results: pageResults,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
