# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Of the CLIs shipped with this framework, `linkedin-search` and `freehire-search` are country-agnostic and relevant to this candidate's market (India); `jobbank-search`, `jobdanmark-search`, `jobindex-search`, and `jobnet-search` are Danish-market demos and are not useful here. `instahyre-search` and `indeed-india-search` were added via `/add-portal` for India-specific coverage. Four other India boards were investigated and rejected - see "Excluded" below for why each one doesn't work.

The `site:` query templates in this file are the **WebSearch fallback** - for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary:
- **linkedin.com/jobs** - LinkedIn job listings (filter: India / Bengaluru); covered by `linkedin-search` CLI
- **in.indeed.com** - Indeed India; covered by `indeed-india-search` CLI. Real server-side search/location/date filtering (unlike Instahyre). robots.txt explicitly allows Claude.
- **instahyre.com** - product/startup-focused Indian job board; covered by `instahyre-search` CLI (client-side filtered, see its SKILL.md)

Excluded (do not `site:` search or fetch these domains with an AI agent):
- **naukri.com** - `robots.txt` explicitly disallows Claude/AI-agent user agents from job listing pages.
- **hirist.tech** (formerly hirist.com) - `robots.txt` has no AI restriction, but the site has fingerprint-based bot detection: it silently serves an empty result set to non-browser HTTP clients (verified: identical requests get real data through a real browser but empty data through curl/Bun `fetch()`, with no header combination changing that). Not pursued since matching that fingerprint would mean evading bot detection.
- **wellfound.com** - serves an explicit DataDome CAPTCHA challenge page to plain HTTP clients. Declined outright.
- If you want coverage of any of these three, check them manually yourself.

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies (see list below)

## Query Categories

Queries are grouped by priority. Each query should be combined with location terms (Bengaluru / India) where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "SDE II" role at one employer may be posted as "Backend Engineer II" or "Software Engineer, Backend" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: Backend / Distributed Systems Engineer (SDE II)

These match Likhit's strongest and most desired career direction.

```
site:linkedin.com/jobs "SDE II" Bengaluru India
site:linkedin.com/jobs "Backend Engineer" Kubernetes Bengaluru
```
Also run: `indeed-india-search search -q "Software Development Engineer II" -l "Bangalore" --jobage 14`, `indeed-india-search search -q "Backend Engineer" -l "Bangalore" --jobage 14`, `instahyre-search search -q "Software Development Engineer II" -l "Bangalore"`, and `instahyre-search search -q "Backend Engineer" -l "Bangalore"`

### Priority 2: GenAI / LLM-Integration Backend Roles

These match Likhit's applied GenAI/LLM domain expertise.

```
site:linkedin.com/jobs "Platform Engineer" LLM Bengaluru India
```
Also run: `indeed-india-search search -q "GenAI backend engineer" -l "Bangalore"`, `instahyre-search search -q "GenAI" -l "Bangalore"`, and `instahyre-search search -q "Member of Technical Staff"`

### Priority 3: Full-Stack / Product Engineer (adjacent roles)

Adjacent roles Likhit could pivot into given his full-stack range.

```
site:linkedin.com/jobs "Product Engineer" Bengaluru India
```
Also run: `indeed-india-search search -q "Full Stack Engineer" -l "Bangalore"` and `instahyre-search search -q "Full Stack Engineer" -l "Bangalore"`

### Priority 4: Broader Technical (wider net)

```
site:linkedin.com/jobs "Software Engineer II" Bengaluru India
```
Also run: `indeed-india-search search -q "Senior Software Engineer" -l "Bangalore"` and `instahyre-search search -q "Senior Software Engineer" -l "Bangalore"`

### Target Companies (monitor directly)

Big tech / global product companies: Google, Microsoft, Amazon, Meta, Apple, Netflix, Uber, Airbnb, Stripe, Datadog, Cloudflare, Snowflake, Confluent, Rippling, Rubrik, Harness, Atlassian, Salesforce, Intuit, Adobe, Nvidia, Palo Alto Networks, Cisco

High-growth Indian product companies: Razorpay, PhonePe, Swiggy, Zepto, Meesho, BrowserStack, Postman, CRED, Groww

```
site:<company-careers-domain> "Software Development Engineer II" Bengaluru
```

## Location Filter

When evaluating results, verify the job location is compatible with Likhit's constraints (Bengaluru-based, open to hybrid/remote, prefers not to relocate):
- Bengaluru (any area) - ideal
- Hybrid roles based in Bengaluru - ideal
- Fully remote (India-based, no relocation required) - acceptable
- Remote requiring periodic travel to another city - borderline, flag for discussion
- On-site roles outside Bengaluru requiring relocation - too far (deal-breaker, exclude)

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape genai" -> Priority 2 queries + custom GenAI-focused queries
