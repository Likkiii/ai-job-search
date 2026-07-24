# Instahyre — Endpoint Reference

Investigated live on 2026-07-24 via browser network inspection (the site is an AngularJS SPA — static HTML fetches only return unrendered templates, so the real endpoints had to be found via the browser's network panel, not by reading page source).

## robots.txt

`https://www.instahyre.com/robots.txt` returns no disallow rules at all (`User-agent: *` with nothing following) — fully open to automated access, including AI crawlers. No personal-use warning is required by robots.txt, but keep volume reasonable regardless.

## Search: `GET /api/v1/job_search`

```
https://www.instahyre.com/api/v1/job_search?offset=<n>
```

- **Auth:** none required.
- **Important limitation:** this endpoint does **not** filter by any query parameter tested (`keywords`, `locations`, `title__icontains`, `locations__icontains`, `city`, `q`) — verified by comparing response byte-size and content across all of these; every variant returned an identical response. It always returns the same generic, paginated "curated opportunities" feed. This is almost certainly a landing/marketing-page feed shown to anonymous visitors, not the real search index (real search/filtering is presumably gated behind a logged-in candidate profile, which this framework does not support — see `/add-portal`'s Step 2 login-wall rule).
- **Pagination:** `offset` genuinely pages through a large corpus — confirmed unique job IDs at `offset=0, 35, 70, 500, 2000`. Page size is fixed at **35 results**. `meta.total_count` in the response (observed ~13,757) reflects the full corpus size, not a filtered count.
- **`limit` param:** tested `limit=50`, had no effect — page size stays fixed at 35.

### Response shape

```json
{
  "objects": [
    {
      "id": 432767,
      "title": "SDET",
      "locations": "Gurgaon",
      "public_url": "https://www.instahyre.com/job-432767-sdet-at-deutsche-telekom-digital-labs-gurgaon/",
      "keywords": ["api", "api testing", "java", "rest assured"],
      "employer": { "company_name": "Deutsche Telekom Digital Labs", "id": 19035, "...": "..." },
      "resource_uri": "/api/v1/job_search/432767"
    }
  ],
  "meta": {
    "total_count": 13757,
    "top_job_functions_count": [...],
    "...": "aggregate stats for the whole platform, not the current query"
  }
}
```

No posting date field exists anywhere in this response — `date` is always `null` in the CLI's output.

## Detail: `GET /api/v1/employer_public_jobs/<id>`

```
https://www.instahyre.com/api/v1/employer_public_jobs/432767
```

- **Auth:** none required.
- Found via browser network inspection while loading a job's public detail page (`/job-<id>-<slug>/`) — the page itself is an Angular template (`ng-if="job"`) with no server-rendered content; this API call is what actually populates it client-side.
- Returns the full job including an **HTML-formatted `description` field** (needs tag-stripping + entity decoding, done in `helpers.ts::htmlDescriptionToText`).

### Response shape (trimmed)

```json
{
  "id": 432767,
  "title": "SDET",
  "hiring_company_name": "Deutsche Telekom Digital Labs",
  "locations": ["Gurgaon"],
  "description": "<html><body><p>...</p><ul><li>...</li></ul></body></html>",
  "is_internship": false,
  "workex_min": 4,
  "workex_max": 8,
  "job_function_dict": { "Software Engineering": ["Other Software Development", "QA / SDET"] },
  "opportunity_url": "/job-432767-sdet-at-deutsche-telekom-digital-labs-gurgaon/",
  "keywords": ["api", "api testing", "java", "rest assured"]
}
```

- `job_search/<id>` (the `resource_uri` from search results) also returns 200 but only re-serves the summary object, **not** the full description — use `employer_public_jobs/<id>` instead for detail.
- No `employment_type` string field; inferred from `is_internship` (bool) as `"Internship"` / `"Full-time"`.
- No application deadline field observed.
- `opportunity_url` is a relative path; the CLI resolves it against `https://www.instahyre.com`.

## Other endpoints seen (not used by this CLI)

- `GET /api/v1/employer_misc/employer_profile/anon_employer/<employerId>?getVisibleJobs=true&limit=10` — other open jobs at the same employer.
- `GET /api/v1/brand_page/similar_jobs?job_id=<id>` — "similar jobs" recommendations.
- `GET /api/v1/job_function`, `/api/v1/industry_type`, `/api/v1/candidate_misc/profile/candidate_locations/location_data` — reference/taxonomy data for form dropdowns.

## Maintenance note

If Instahyre changes its markup or API shape, re-run the reconnaissance from `/add-portal` Step 2 using the browser's network inspector (`mcp__Claude_Browser__read_network_requests`) rather than `curl`/`WebFetch` — the site is a client-rendered AngularJS SPA and static HTML fetches will not reveal the real data endpoints.
