import { describe, test, expect } from "bun:test"
import { parseJobCards, parseJobDetail, extractDivContentById } from "../src/helpers"

const SAMPLE_CARD_HTML = `
<table><tr><td class="resultContent">
  <h3 class="jobTitle"><a data-jk="01e6756464a2a91b" href="/rc/clk?jk=01e6756464a2a91b">
    <span id="jobTitle-01e6756464a2a91b">Sr. Backend Engineer</span>
  </a></h3>
  <div class="company_location">
    <span data-testid="company-name">PinnacleU</span>
    <div data-testid="text-location">Bengaluru, Karnataka</div>
  </div>
  <li class="salary-snippet-container" data-testid="attribute_snippet_testid salary-snippet-container">
    <span>&#8377;35,00,000 - &#8377;40,00,000 a year</span>
  </li>
</td></tr></table>
`

describe("parseJobCards", () => {
  test("extracts id, title, company, location, salary", () => {
    const cards = parseJobCards(SAMPLE_CARD_HTML)
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe("01e6756464a2a91b")
    expect(cards[0].title).toBe("Sr. Backend Engineer")
    expect(cards[0].company).toBe("PinnacleU")
    expect(cards[0].location).toBe("Bengaluru, Karnataka")
    expect(cards[0].salary).toContain("35,00,000")
    expect(cards[0].url).toContain("01e6756464a2a91b")
  })

  test("card with no title is skipped", () => {
    const html = `<div data-jk="deadbeefdeadbeef">no title here</div>`
    expect(parseJobCards(html)).toHaveLength(0)
  })

  test("empty input returns empty array", () => {
    expect(parseJobCards("")).toEqual([])
  })
})

describe("extractDivContentById", () => {
  test("extracts nested div content correctly", () => {
    const html = `<div id="jobDescriptionText"><p>Line one</p><div><p>Nested</p></div></div>`
    const content = extractDivContentById(html, "jobDescriptionText")
    expect(content).toContain("Line one")
    expect(content).toContain("Nested")
  })

  test("returns null when id not found", () => {
    expect(extractDivContentById("<div>no match</div>", "missing")).toBeNull()
  })
})

describe("parseJobDetail", () => {
  test("extracts title, company, location, description", () => {
    const html = `
      <h1 data-testid="jobsearch-JobInfoHeader-title"><span>Sr. Backend Engineer</span></h1>
      <div data-testid="inlineHeader-companyName">PinnacleU</div>
      <div data-testid="inlineHeader-companyLocation">Bengaluru, Karnataka</div>
      <div id="jobDescriptionText"><p>Build things.</p><ul><li>One</li><li>Two</li></ul></div>
    `
    const job = parseJobDetail(html, "01e6756464a2a91b")
    expect(job.title).toBe("Sr. Backend Engineer")
    expect(job.company).toBe("PinnacleU")
    expect(job.location).toBe("Bengaluru, Karnataka")
    expect(job.description).toContain("Build things.")
    expect(job.description).toContain("- One")
    expect(job.url).toContain("01e6756464a2a91b")
  })

  test("falls back to (untitled) when title missing", () => {
    const job = parseJobDetail("<html></html>", "abc123")
    expect(job.title).toBe("(untitled)")
  })
})
