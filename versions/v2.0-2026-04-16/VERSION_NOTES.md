# Version 2.0 — 2026-04-16

## Overview
Major feature expansion over v1.0. Adds organizational peer-rating support, AI-powered coaching chat, benchmark intelligence dashboard, peer invite emails, enriched social scraping, security hardening, and extensive research assets based on the PhD dissertation data.

---

## What's New

### New API Endpoints
| File | Purpose |
|------|---------|
| `api/benchmarks.js` | Industry/seniority benchmark aggregation — serves the Intelligence Dashboard with live percentile data |
| `api/chat.js` | AI coaching chat (Claude-powered) — personalized brand development advice based on archetype and scores |
| `api/send-peer-invite.js` | Sends peer rating invitation emails via Resend, generates secure peer links |

### Expanded Scraping Suite
`api/scrape-orcid.js`, `api/scrape-researchgate.js`, `api/scrape-youtube.js` added alongside existing LinkedIn, GitHub, Scholar, and Google Presence scrapers.

### Database
- `schema_additions.sql` — adds `source` column to assessments (dissertation seed data marker), `peer_invites` table (individual peer invites outside org mode), `benchmark_cache` table (nightly precomputed averages by industry/seniority)
- `migration_security_fixes.sql` — resolves 2 Supabase security advisories:
  - `handle_new_user()` function: `SET search_path = public` added (search-path injection prevention)
  - `admin_assessments` view: `security_invoker = on` (replaces implicit SECURITY DEFINER)

### Frontend (`App.html`)
- +1,500 lines vs v1.0
- Organizational mode: team dashboard, peer assignment matrix, admin controls
- AI coaching chat panel integrated into results view
- Intelligence Dashboard: live benchmarks, archetype distribution charts, industry comparisons
- Peer invite flow (individual mode): share link → peer fills assessment → scores averaged
- Famous-people brand matching: results now include a "your brand matches [name]" card
- Social enrichment UI: LinkedIn/GitHub/Scholar/ORCID/ResearchGate/YouTube URL inputs with live score adjustment preview
- UX polish: progress animations, dimension bar micro-interactions, archetype reveal animation

### Research Assets
- `data-analysis-report.md` — full statistical analysis of dissertation dataset (n=202)
- `ANALYSIS_SUMMARY.txt` — key findings summary
- `famous-people-matching-framework.md` — archetype-to-public-figure mapping methodology
- `famous-people-roster.md` — curated list of 40+ public figures mapped to archetypes
- `persona-voice-cards.md` — AI coaching voice/tone guide per archetype
- `implementation-plan-v2.md` — technical roadmap for v3 (backend, auth, org billing)

---

## Security Changes (vs v1.0)
- `handle_new_user` trigger function: search_path pinned — closes theoretical schema-injection vector
- `admin_assessments` view: security_invoker = on — Supabase ERROR-level advisory resolved
- Intentional open policies documented: `org_members` INSERT (join-code self-join), `peer_invites` UPDATE (anonymous completion)

---

## Migration from v1.0
1. Run `schema_additions.sql` in Supabase SQL Editor (adds 3 new tables/columns)
2. Run `migration_security_fixes.sql` (safe — no data changes, DDL only)
3. Deploy updated `App.html` and new `api/*.js` files to Vercel
4. Set new env vars: `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (see `.env.example`)

---

## Environment Variables Added
```
ANTHROPIC_API_KEY=      # Claude API key for coaching chat
RESEND_API_KEY=         # Resend API key for peer invite emails
```

---

*Personal Brand Equity Calculator — Péter Szántó*
*PhD dissertation: "Understanding and Quantifying Personal Branding" — Budapest Business University*
