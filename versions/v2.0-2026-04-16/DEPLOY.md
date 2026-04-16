# Deployment Guide — Personal Brand Equity Calculator

This app runs entirely on **Vercel** (static hosting + serverless functions) + **Supabase** (PostgreSQL database + Auth). No server to manage. Free tier of both platforms covers thousands of users.

---

## Prerequisites

- A [Vercel account](https://vercel.com) (free)
- A [Supabase account](https://supabase.com) (free)
- Git repository (GitHub, GitLab, or Bitbucket)

---

## Step 1 — Create Your Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Choose a name (e.g. `pbes-calculator`), strong database password, and region close to your users
3. Wait ~2 minutes for provisioning

### Run the Schema

4. In your Supabase project, open **SQL Editor** → **New query**
5. Paste the full contents of `schema.sql` from this folder
6. Click **Run** — all tables, RLS policies, and triggers will be created

### Get Your API Keys

7. Go to **Settings → API** in your Supabase project
8. Copy:
   - **Project URL** (looks like `https://abcdefghij.supabase.co`)
   - **anon / public** key (safe to embed in frontend)
   - **service_role** key (⚠️ keep secret — only for server-side)

---

## Step 2 — Configure the App

### Embed Your Keys in App.html

Open `App.html` and find the `SUPA_CONFIG` block near the top of the `<script>` section:

```js
const SUPA_CONFIG = {
  url: '',   // ← paste your Project URL here
  key: '',   // ← paste your anon/public key here
};
```

> **Why is this safe?** The anon key is designed to be public. Supabase Row Level Security (RLS) policies — which are already set up in `schema.sql` — ensure users can only access their own data. The service_role key (used only in `/api/admin-data.js`) stays in environment variables, never in the frontend.

### Configure the Admin Endpoint

The `/api/admin-data.js` serverless function uses environment variables. These are set in Vercel (Step 4), not in the frontend.

---

## Step 3 — Push to Git

Create a Git repository and push all files. Vercel deploys from Git.

```bash
git init
git add .
git commit -m "Initial PBES calculator deployment"
git remote add origin https://github.com/yourusername/pbes-calculator.git
git push -u origin main
```

**Important:** Rename `App.html` to `index.html` before deploying so Vercel serves it as the root page:
```bash
mv App.html index.html
git add .
git commit -m "Rename App.html to index.html for Vercel"
git push
```

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select your repository → click **Deploy**
3. Vercel auto-detects `vercel.json` and configures routes + functions

### Add Environment Variables

After the first deploy, go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value | Environments |
|----------|-------|-------------|
| `SUPA_URL` | Your Supabase project URL | Production, Preview, Development |
| `SUPA_SERVICE_KEY` | Your service_role key | Production, Preview, Development |
| `ADMIN_SECRET` | Your chosen admin password | Production, Preview, Development |
| `GITHUB_TOKEN` | (Optional) GitHub PAT for higher rate limits | Production |

Click **Save** and **Redeploy** for changes to take effect.

---

## Step 5 — Configure Supabase Auth (Email)

1. In Supabase → **Authentication → Providers** → confirm **Email** is enabled
2. In **Authentication → Email Templates**, customize the password reset email if desired
3. In **Authentication → URL Configuration**, set:
   - **Site URL**: your Vercel domain (e.g. `https://pbes.vercel.app`)
   - **Redirect URLs**: add `https://pbes.vercel.app/?login=1`

---

## Step 6 — Set Up Custom Domain (Optional)

1. In Vercel → **Settings → Domains** → add your domain
2. In Supabase → **Authentication → URL Configuration** → update Site URL and Redirect URLs to your custom domain

---

## Verifying the Deployment

After deploying, test these endpoints:

```
GET /api/scrape-linkedin?url=https://linkedin.com/in/yourname
GET /api/scrape-github?url=https://github.com/yourusername
GET /api/scrape-orcid?url=https://orcid.org/0000-0002-1825-0097
GET /api/admin-data?action=stats   (requires X-Admin-Secret header)
```

---

## Architecture Overview

```
Browser (App.html / index.html)
  │
  ├── Supabase JS SDK (@2)      ← auth sign-in/up/out + data read/write
  │   └── Supabase PostgreSQL   ← assessments, orgs, peers (cloud database)
  │
  └── Vercel Serverless Functions (/api/*.js)
      ├── scrape-linkedin.js    ← server-side LinkedIn HTML scraper
      ├── scrape-scholar.js     ← Google Scholar HTML scraper
      ├── scrape-orcid.js       ← ORCID public API (free, no key needed)
      ├── scrape-github.js      ← GitHub REST API v3 (60 req/hr free)
      ├── scrape-researchgate.js← ResearchGate HTML scraper
      ├── scrape-youtube.js     ← YouTube Data API v3 (free key, 10k/day)
      ├── google-presence.js    ← DuckDuckGo + Bing web presence analysis
      └── admin-data.js         ← admin analytics (service_role protected)

## Platform Coverage Summary

| Platform | Method | Free? | Auto-fills metrics? |
|----------|--------|-------|---------------------|
| LinkedIn | Server-side HTML + JSON-LD | ✅ No key | ✅ Connections, endorsements, recs |
| Google Scholar | HTML scrape | ✅ No key | ✅ h-index, citations, paper count |
| ORCID | Official public API | ✅ No key | ✅ Works/publications count |
| GitHub | Official REST API | ✅ No key (60/hr) | ✅ Followers, stars |
| ResearchGate | HTML scrape (Cloudflare limited) | ✅ No key | ✅ Publications, h-index |
| YouTube | YouTube Data API v3 | ✅ Free key needed | ✅ Subscribers, video count |
| Web Presence | DuckDuckGo + Bing name search | ✅ No key | ✅ Score boosts by source type |
| Twitter/X | No free API (closed 2023) | ❌ Manual entry | — Enter follower count manually |
| Facebook | No public API | ❌ Manual entry | — Enter count manually (deep link provided) |
| Instagram | API shutdown Dec 2024 | ❌ Manual entry | — Enter count manually (deep link provided) |
| TikTok | Research API only | ❌ Manual entry | — Enter count manually (deep link provided) |
```

---

## Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 100GB bandwidth, unlimited deployments | $20/mo (Pro) |
| Supabase | 500MB DB, 50,000 MAU Auth | $25/mo (Pro) |
| Custom domain | ~€10/year | — |

The free tier is sufficient for hundreds to low thousands of users.

---

## Troubleshooting

**"Supabase not configured" message on login:** You haven't set `SUPA_CONFIG.url` and `SUPA_CONFIG.key` in App.html. The app will fall back to localStorage mode (works locally, not across devices).

**Scraping returns "blocked" or "login required":** LinkedIn and ResearchGate aggressively limit automated access. This is expected — the user should enter the metrics manually as a fallback.

**`/api/admin-data` returns 401:** You need to pass the `X-Admin-Secret` header. The admin panel does this automatically; check your `ADMIN_SECRET` env var.

**Vercel function timeout:** All scraper functions have an 8–10 second abort timeout and `vercel.json` allows up to 15 seconds. If a platform is slow, the function returns a graceful fallback.
