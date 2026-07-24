import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

interface SearchResult {
  meta: { count: number; page: number }
  results: Array<{ id: string; title: string; url: string }>
}

// Live smoke tests against Instahyre's real public endpoints. Per repo convention
// (see linkedin-search), keep volume low — this hits the network a handful of times.
describe("live: search + detail", () => {
  test("search with a realistic query returns real results", async () => {
    const result = await runCLI(["search", "-q", "backend engineer", "-l", "Bangalore", "--limit", "5"])
    const data = parseJSON<SearchResult>(result)

    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toContain("instahyre.com")
    }
  }, 30000)

  test("detail on a result from search returns a readable description", async () => {
    const searchResult = await runCLI(["search", "-q", "engineer", "--limit", "1"])
    const data = parseJSON<SearchResult>(searchResult)
    expect(data.results.length).toBeGreaterThan(0)

    const id = data.results[0].id
    const detailResult = await runCLI(["detail", id, "--format", "plain"])
    expect(detailResult.exitCode).toBe(0)
    expect(detailResult.stdout.length).toBeGreaterThan(0)
  }, 30000)
})
