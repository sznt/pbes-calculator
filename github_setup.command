#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# PBES Calculator — GitHub Setup Script
# Double-click this file or run it in Terminal to initialize git & push to GitHub
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error

cd "$(dirname "$0")"
echo "📁 Working in: $(pwd)"
echo ""

# ── Clean up any failed git init ────────────────────────────────────────────
if [ -d ".git" ]; then
  echo "🧹 Removing previous incomplete git init..."
  rm -rf .git
fi

# ── Initialize fresh repo ────────────────────────────────────────────────────
git init
git branch -m main
git config user.name "Péter Szántó"
git config user.email "peter.szanto.hu@gmail.com"

# ── Stage all files (respects .gitignore — .env excluded) ────────────────────
git add -A

echo ""
echo "📦 Files staged:"
git diff --cached --name-only | head -30
echo "  ... and $(git diff --cached --name-only | wc -l | tr -d ' ') total files"

# ── Initial commit ────────────────────────────────────────────────────────────
git commit -m "Initial commit — PBES Calculator v2.0

Personal Brand Equity Calculator based on PhD dissertation
'Understanding and Quantifying Personal Branding' by Péter Szántó
Budapest Business University, Doctoral School of Entrepreneurship and Business

Features:
- 28-question Myers-Briggs-style PBES assessment (Brand Appeal, Differentiation, Recognition)
- 8 Personal Brand Archetypes with full coaching profiles
- Individual + Organizational modes with peer rating system (sPBE + ePBE)
- Social profile enrichment (LinkedIn, Google Scholar, ORCID, ResearchGate, YouTube, GitHub)
- AI coaching chat (Claude-powered, archetype-aware)
- Intelligence Dashboard with industry/seniority benchmarks
- Peer invite emails via Resend
- Vercel serverless deployment + Supabase PostgreSQL backend

Security: Supabase security advisories resolved
  - handle_new_user: SET search_path = public
  - admin_assessments: security_invoker = on"

# ── Tag v2.0 ──────────────────────────────────────────────────────────────────
git tag -a v2.0 -m "Version 2.0 — 2026-04-16

Major release: Org mode, AI coaching, benchmarks, peer invites,
expanded scraping, security hardening, dissertation data analysis"

echo ""
echo "✅ Commit and tag created:"
git log --oneline -1
git tag -l

# ── Create GitHub repo & push ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Creating GitHub repo and pushing..."
echo "═══════════════════════════════════════════════════════════"

# Check if gh CLI is available
if command -v gh &>/dev/null; then
  echo "Using GitHub CLI (gh)..."
  gh repo create pbes-calculator \
    --private \
    --description "Personal Brand Equity Calculator — Myers-Briggs-style PBES assessment tool based on PhD dissertation" \
    --source=. \
    --remote=origin \
    --push

  # Push tags separately
  git push origin --tags

  echo ""
  echo "✅ Pushed to GitHub!"
  gh repo view --web

else
  echo "⚠️  GitHub CLI (gh) not found."
  echo ""
  echo "Option 1 — Install gh and re-run this script:"
  echo "  brew install gh && gh auth login"
  echo ""
  echo "Option 2 — Manual push:"
  echo "  1. Go to https://github.com/new"
  echo "  2. Create repo named: pbes-calculator (private)"
  echo "  3. Run these commands:"
  echo ""
  echo "     git remote add origin https://github.com/YOUR_USERNAME/pbes-calculator.git"
  echo "     git push -u origin main"
  echo "     git push origin --tags"
  echo ""
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🏷️  Version snapshot saved: versions/v2.0-2026-04-16/"
echo "═══════════════════════════════════════════════════════════"
