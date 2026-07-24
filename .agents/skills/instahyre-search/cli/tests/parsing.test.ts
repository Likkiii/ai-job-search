import { describe, test, expect } from "bun:test"
import { matchesQuery, matchesLocation, htmlDescriptionToText, normalizeId, type JobCard } from "../src/helpers"

function card(overrides: Partial<JobCard> = {}): JobCard {
  return {
    id: "1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Bangalore",
    date: null,
    url: "https://www.instahyre.com/job-1-backend-engineer-at-acme-bangalore/",
    keywords: ["java", "spring"],
    ...overrides,
  }
}

describe("matchesQuery", () => {
  test("no query matches everything", () => {
    expect(matchesQuery(card(), undefined)).toBe(true)
  })

  test("matches title case-insensitively", () => {
    expect(matchesQuery(card(), "backend")).toBe(true)
    expect(matchesQuery(card(), "BACKEND")).toBe(true)
  })

  test("matches keywords when title does not match", () => {
    expect(matchesQuery(card({ title: "SDE II" }), "spring")).toBe(true)
  })

  test("no match returns false", () => {
    expect(matchesQuery(card(), "frontend")).toBe(false)
  })
})

describe("matchesLocation", () => {
  test("no location filter matches everything", () => {
    expect(matchesLocation(card(), undefined)).toBe(true)
  })

  test("matches substring case-insensitively", () => {
    expect(matchesLocation(card({ location: "Bangalore,Pune" }), "pune")).toBe(true)
  })

  test("null location never matches a filter", () => {
    expect(matchesLocation(card({ location: null }), "bangalore")).toBe(false)
  })

  test("no match returns false", () => {
    expect(matchesLocation(card(), "mumbai")).toBe(false)
  })
})

describe("htmlDescriptionToText", () => {
  test("strips tags and decodes entities", () => {
    const html = "<p>Build &amp; ship <strong>APIs</strong>.</p>"
    expect(htmlDescriptionToText(html)).toBe("Build & ship APIs.")
  })

  test("converts list items to dashed lines", () => {
    const html = "<ul><li>One</li><li>Two</li></ul>"
    const text = htmlDescriptionToText(html)
    expect(text).toContain("- One")
    expect(text).toContain("- Two")
  })

  test("collapses excessive blank lines", () => {
    const html = "<p>A</p><br/><br/><br/><p>B</p>"
    const text = htmlDescriptionToText(html)
    expect(text).not.toMatch(/\n{3,}/)
  })
})

describe("normalizeId", () => {
  test("accepts a bare numeric id", () => {
    expect(normalizeId("432767")).toBe("432767")
  })

  test("extracts id from a full job URL", () => {
    expect(normalizeId("https://www.instahyre.com/job-432767-sdet-at-deutsche-telekom-digital-labs-gurgaon/")).toBe(
      "432767",
    )
  })

  test("returns null for unparseable input", () => {
    expect(normalizeId("not-a-job-url")).toBeNull()
  })
})
