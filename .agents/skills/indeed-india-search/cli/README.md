# indeed-india-cli

CLI for searching jobs on [Indeed India](https://in.indeed.com) via its public, server-rendered job-search pages. Zero *package* dependencies — just `bun` plus the system `curl` binary (see Transport note below).

`in.indeed.com`'s `robots.txt` explicitly lists `Claude-User` and `Claude-SearchBot` with `Allow: /` (the same minor tracking-param exclusions everyone gets) — this site's policy explicitly welcomes AI agents, unlike Naukri which explicitly disallows them.

## Transport note: curl, not fetch()

This CLI shells out to the system `curl` binary instead of using Bun's native `fetch()`. Verified live: Bun's `fetch()` was consistently 403'd by Indeed's WAF (retried 3x with identical headers) while plain `curl` consistently succeeded — a TLS/HTTP-client-fingerprint mismatch, not a deliberate challenge (no CAPTCHA is ever shown, and robots.txt explicitly invites this traffic). `curl` is required on `PATH`; it's present on effectively all dev machines and already a documented dependency elsewhere in this repo's setup docs.

## Install

```bash
cd .agents/skills/indeed-india-search/cli
bun install
```

## Usage

```bash
bun run src/cli.ts search -q "backend engineer" -l "Bangalore" --format table
bun run src/cli.ts search -q "SDE II" -l "Bengaluru, Karnataka" --jobage 14 --format table
bun run src/cli.ts detail 01e6756464a2a91b --format plain
```

## Commands

- `search` — real server-side filtering by `--query`, `--location`, and `--jobage` (maps to Indeed's `fromage` param). Genuine pagination via `--page`.
- `detail <jk|url>` — fetches full description, company, location, and salary (when shown) for one posting.

## Notes

- Job cards do not expose a reliably parseable posting date in the markup, so the `date` field in results is always `null`. `--jobage` still filters correctly server-side even though the per-card date isn't displayed.
- Salary is included in both `search` and `detail` output when Indeed shows it on the listing.

## Data source

- Search: `https://in.indeed.com/jobs?q=<query>&l=<location>&start=<offset>&fromage=<days>` (public, server-rendered, 10 results/page)
- Detail: `https://in.indeed.com/viewjob?jk=<id>` (public, server-rendered)

See `../url-reference.md` for full endpoint documentation.

## Tests

```bash
bun run test
bun run typecheck
```
