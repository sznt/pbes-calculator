# Version 1.0 — Snapshot: 2026-04-09

## What this is
A complete, working snapshot of the Personal Brand Equity Calculator at the point it was first deployed to production.

## Live deployment
- URL: https://pbes-calculator.vercel.app
- Platform: Vercel (project: pbes-calculator)
- GitHub repo: https://github.com/sznt/pbes-calculator

## What's included in this snapshot
| File | Description |
|------|-------------|
| `App.html` | **Main application** — full React SPA, 336 KB, self-contained (Babel + React bundled inline) |
| `App-test.html` | Earlier test/prototype version (264 KB) |
| `schema.sql` | Supabase PostgreSQL schema (users, orgs, assessments, social_profiles, etc.) |
| `vercel.json` | Vercel routing config (API routes + SPA fallback) |
| `.env.example` | Template showing all required environment variables (no secrets) |
| `.gitignore` | Git ignore rules |
| `api/` | 8 Vercel serverless API endpoints |

## API endpoints (api/)
| File | Purpose |
|------|---------|
| `admin-data.js` | Admin dashboard data (protected by ADMIN_SECRET) |
| `google-presence.js` | Google search presence scraping |
| `scrape-github.js` | GitHub profile enrichment |
| `scrape-linkedin.js` | LinkedIn profile scraping |
| `scrape-orcid.js` | ORCID academic profile scraping |
| `scrape-researchgate.js` | ResearchGate scraping |
| `scrape-scholar.js` | Google Scholar scraping |
| `scrape-youtube.js` | YouTube channel enrichment |

## Feature state at v1.0
- ✅ 28-question Myers-Briggs-style PBES questionnaire (sliders)
- ✅ 8 Personal Brand Archetypes (BA/BD/BR High/Low matrix)
- ✅ Weighted PBE score (BA×0.45 + BD×0.35 + BR×0.20)
- ✅ Archetype profiles with strengths, growth areas, 5 recommendations each
- ✅ Brand Intentionality (BI) supplementary questions
- ✅ Social profile URL input fields (LinkedIn, Twitter, Facebook, Scholar, etc.)
- ✅ External enrichment API stubs (scraping endpoints)
- ✅ Supabase database schema ready
- ✅ Environment variables set in Vercel (SUPA_URL, SUPA_SERVICE_KEY, ADMIN_SECRET, YOUTUBE_API_KEY, GITHUB_TOKEN)

## Environment variables required
```
SUPA_URL=           # Supabase project URL
SUPA_SERVICE_KEY=   # Supabase service role key (secret)
ADMIN_SECRET=       # Admin dashboard access secret
YOUTUBE_API_KEY=    # YouTube Data API v3 key
GITHUB_TOKEN=       # GitHub PAT for scraping (read:user scope)
```

## To restore this version
1. Copy `App.html` → deploy to Vercel (or open locally in browser — it's fully self-contained)
2. Run `schema.sql` in Supabase SQL editor to recreate the database
3. Set the 5 env vars in Vercel project settings
4. Deploy `api/` folder alongside `App.html`
