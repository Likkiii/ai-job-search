# Indeed India — Endpoint Reference

Investigated live on 2026-07-24/25 via plain `curl` (this site is server-rendered, unlike Instahyre and Hirist which needed browser network inspection).

## robots.txt

`https://in.indeed.com/robots.txt` explicitly lists a block of AI-agent user agents — `Claude-User`, `Claude-SearchBot`, `Gemini-Deep-Research`, `OAI-SearchBot`, `Meta-WebIndexer`, `xAI-Grok`, etc. — with **`Allow: /`**, followed by the same narrow tracking/redirect-param disallows every other user agent gets (`?rt=nc`, `&alid=`, `&calert=`, `?rss`, `/vaclk`, etc. — none touch job search or detail pages). This is an explicit, deliberate policy welcoming AI agents, in contrast to Naukri (which explicitly disallows the same agent names) and the implicit CAPTCHA/bot-detection walls found on Hirist and Wellfound.

## Search: `GET /jobs`

```
https://in.indeed.com/jobs?q=<query>&l=<location>&start=<offset>&fromage=<days>
```

- **Auth:** none required.
- **Real server-side filtering confirmed** — unlike Instahyre, `q`, `l`, and `fromage` all genuinely change the result set (verified: `fromage=7` returned a different, smaller set than unfiltered; `start=10` returned 16 unique job IDs with zero overlap against `start=0`).
- **Pagination:** `start` is 0-indexed in increments of 10 (i.e. `start=0` = page 1, `start=10` = page 2). Fixed page size of 10 results.
- **`fromage`:** days since posting (e.g. `fromage=7` = posted in the last 7 days). Maps to `--jobage`.

### Job card markup (per result)

Job cards are plain server-rendered HTML inside a results table, anchored by a stable `data-jk="<16-char hex id>"` attribute on the title link:

```html
<h3 class="jobTitle"><a data-jk="01e6756464a2a91b" href="/rc/clk?jk=01e6756464a2a91b&...">
  <span id="jobTitle-01e6756464a2a91b">Sr. Backend Engineer</span>
</a></h3>
<div class="company_location">
  <span data-testid="company-name">PinnacleU</span>
  <div data-testid="text-location">Bengaluru, Karnataka</div>
</div>
<li class="salary-snippet-container" data-testid="attribute_snippet_testid salary-snippet-container">
  <span>₹35,00,000 - ₹40,00,000 a year</span>
</li>
```

Parsing anchors used (`helpers.ts::parseJobCards`):
- id: `data-jk="..."` attribute
- title: `<span id="jobTitle-<id>">`
- company: `data-testid="company-name"`
- location: `data-testid="text-location"`
- salary (optional): nearest `<span>` inside a `salary-snippet-container` block

**No parseable posting date found on the search results page** in any variant tested (no `myJobsStateDate` testid, no "Posted N days ago" text, no `date` class) — `date` is always `null` in card output, even though `fromage` genuinely filters server-side.

There is also a large embedded `window._initialData = {...}` JSON blob and a `window.mosaic.initialData` blob on the page, but the actual job list is **not** inside either (their job-related keys were empty/null in testing) — the real data lives in the plain HTML table markup described above, not in embedded JSON. Don't waste time trying to parse those blobs for job data.

## Detail: `GET /viewjob?jk=<id>`

```
https://in.indeed.com/viewjob?jk=01e6756464a2a91b
```

- **Auth:** none required, plain server-rendered HTML.
- Parsing anchors used (`helpers.ts::parseJobDetail`):
  - title: `data-testid="jobsearch-JobInfoHeader-title"` (inside an `<h1>`, sometimes wrapped in a `<span>`)
  - company: `data-testid="inlineHeader-companyName"`
  - location: `data-testid="inlineHeader-companyLocation"`
  - salary (optional): `id="salaryInfoAndJobType"` (not always present)
  - description: `id="jobDescriptionText"` — nested `<div>`s, extracted with depth-tracking (`extractDivContentById`), same technique as `linkedin-search`'s `extractDivContent`

## Portals investigated and rejected before landing on Indeed

- **Naukri.com** — `robots.txt` explicitly disallows `Claude-User`/`claudebot`/etc. No official public API exists either (`/api-docs` 404s, `developer.naukri.com` doesn't resolve).
- **Hirist.tech** (formerly hirist.com) — `robots.txt` has no AI restriction, but the site has active bot-detection: a plain `curl` request (even with a full browser-like header set: `sec-ch-ua`, `Accept-Language`, `referer`, etc.) always receives an empty `jobfeed: []` SSR shell, while a real browser (verified via `mcp__Claude_Browser`) receives full server-rendered listings on the *same URL* with no separate client-side API call ever firing — meaning the origin is deciding what to serve based on a deeper fingerprint (TLS/HTTP stack), not headers. The page's own embedded state also includes a `botDetection` object with a `captchaSiteKey` field. Not pursued further, since matching that fingerprint would mean evading bot detection.
- **Wellfound.com** — a plain `curl` to `/jobs` returns HTTP 403 with an explicit **DataDome CAPTCHA challenge** page (`captcha-delivery.com` script, `dd` config object). Declined outright — no attempt made to solve or route around it.

## Transport: curl, not Bun's fetch()

Verified live and reproduced 3x: Bun's native `fetch()` consistently receives HTTP 403 from Indeed's WAF for `/jobs` searches, even with a full standard browser-like header set (`User-Agent`, `Accept`, `Accept-Language`, `Accept-Encoding`, `Connection`, `Upgrade-Insecure-Requests`). Plain `curl` from the same machine, same network, same headers, consistently succeeds (200). This points to a TLS/HTTP-client-level fingerprint difference between Bun's and curl's network stacks, not a header or content issue, and not a deliberate CAPTCHA/challenge (none is ever shown). Since `curl` is an unmodified, ubiquitous standard tool (not something tuned to spoof a fingerprint) and Indeed's own robots.txt explicitly invites this traffic, `helpers.ts::curlFetch` shells out to `curl` via `Bun.spawn` instead of using `fetch()`. Requires `curl` on `PATH`.

## Maintenance note

Indeed periodically changes CSS class names (the emotion-generated hashed classes like `css-1o6lhys` are unstable across deploys) but the `data-testid` and `data-jk` attributes have been stable identifiers historically. If parsing breaks, re-fetch a live search page with `curl` and re-run the anchor searches in this file (`data-testid="company-name"`, etc.) before assuming the site needs JS rendering — this is one of the few portals in this repo where plain `curl` is sufficient (Bun's `fetch()` is not, see Transport section above).
