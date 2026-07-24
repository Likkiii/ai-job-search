# instahyre-cli

CLI for searching jobs on [Instahyre](https://www.instahyre.com) (India, product/startup focus) via its public JSON endpoints. Zero runtime dependencies — just `bun` and `fetch`.

## Important limitation

Instahyre's anonymous `/api/v1/job_search` endpoint does **not** honor `keywords`/`locations` query params — it always returns the same paginated "curated opportunities" feed (~35 results/page) regardless of what's passed. Real personalized/filtered search only works for logged-in candidates with a completed profile.

To still provide useful `--query`/`--location` filtering, this CLI scans up to 40 raw pages (~1,400 postings) of the anonymous feed per `search` call and filters client-side. This is slower and less exhaustive than a true server-side search (like `linkedin-search`) — treat results as a best-effort sample, not a guarantee of full recall.

`--jobage` is not supported: the portal's public feed does not expose posting dates.

## Install

```bash
cd .agents/skills/instahyre-search/cli
bun install
```

## Usage

```bash
bun run src/cli.ts search -q "backend engineer" -l "Bangalore" --format table
bun run src/cli.ts search -q "SDE II" --limit 20 --format table
bun run src/cli.ts detail 432767 --format plain
```

## Commands

- `search` — scans the anonymous feed, filters client-side by `--query` (title/keywords substring) and `--location` (locations substring), returns a page of matches.
- `detail <id|url>` — fetches full detail (description, employment type, experience range, job function) for one posting via `/api/v1/employer_public_jobs/<id>`.

## Data source

- Search: `https://www.instahyre.com/api/v1/job_search?offset=<n>` (public, unauthenticated, 35 results/page, ignores filter params)
- Detail: `https://www.instahyre.com/api/v1/employer_public_jobs/<id>` (public, unauthenticated, full HTML description + metadata)

See `../url-reference.md` for full endpoint documentation.

## Tests

```bash
bun run test
bun run typecheck
```
