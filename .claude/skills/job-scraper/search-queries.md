# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Of the CLIs shipped with this framework, `linkedin-search` and `freehire-search` are country-agnostic and relevant to this candidate's market (India); `jobbank-search`, `jobdanmark-search`, `jobindex-search`, and `jobnet-search` are Danish-market demos and are not useful here. `instahyre-search` was added via `/add-portal` for India-specific, product/startup-focused coverage (see its `SKILL.md` for an important caveat: it filters client-side since Instahyre's public API ignores query/location params for anonymous requests). Naukri was investigated but declined - its `robots.txt` explicitly disallows Claude/AI-agent user agents from job listing pages.

The `site:` query templates in this file are the **WebSearch fallback** - for portals without a CLI, company career pages, or when a CLI fails.

## Search Sites

Primary:
- **linkedin.com/jobs** - LinkedIn job listings (filter: India / Bengaluru); covered by `linkedin-search` CLI
- **instahyre.com** - product/startup-focused Indian job board; covered by `instahyre-search` CLI (client-side filtered, see its SKILL.md)

Excluded:
- **naukri.com** - India's largest general job board, but its `robots.txt` explicitly disallows Claude/AI-agent user agents from job listing pages. Do not `site:` search or fetch this domain with an AI agent. If you want Naukri coverage, check it manually yourself.

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies (see list below)

## Query Categories

Queries are grouped by priority. Each query should be combined with location terms (Bengaluru / India) where the site supports it.

### Priority 1: Backend / Distributed Systems Engineer (SDE II)

These match Likhit's strongest and most desired career direction.

```
site:linkedin.com/jobs "SDE II" Bengaluru India
site:linkedin.com/jobs "Backend Engineer" Kubernetes Bengaluru
```
Also run: `instahyre-search search -q "Software Development Engineer II" -l "Bangalore"` and `instahyre-search search -q "Backend Engineer" -l "Bangalore"`

### Priority 2: GenAI / LLM-Integration Backend Roles

These match Likhit's applied GenAI/LLM domain expertise.

```
site:linkedin.com/jobs "Platform Engineer" LLM Bengaluru India
```
Also run: `instahyre-search search -q "GenAI" -l "Bangalore"` and `instahyre-search search -q "Member of Technical Staff"`

### Priority 3: Full-Stack / Product Engineer (adjacent roles)

Adjacent roles Likhit could pivot into given his full-stack range.

```
site:linkedin.com/jobs "Product Engineer" Bengaluru India
```
Also run: `instahyre-search search -q "Full Stack Engineer" -l "Bangalore"`

### Priority 4: Broader Technical (wider net)

```
site:linkedin.com/jobs "Software Engineer II" Bengaluru India
```
Also run: `instahyre-search search -q "Senior Software Engineer" -l "Bangalore"`

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

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape genai" -> Priority 2 queries + custom GenAI-focused queries
