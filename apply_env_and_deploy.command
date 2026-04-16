#!/bin/bash
# Adds SUPA_URL, SUPA_SERVICE_KEY, ADMIN_SECRET to Vercel, then redeploys.
# Self-deletes after running.

TOKEN="YOUR_VERCEL_TOKEN"
PROJECT_ID="prj_TQtwBurp6q0EgsSLondg2GEFn58I"
SUPA_URL="https://wcjlpbfcbezwiprlzvck.supabase.co"
SUPA_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamxwYmZjYmV6d2lwcmx6dmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY4ODU1NiwiZXhwIjoyMDkxMjY0NTU2fQ.6wMHOLA25RXDuvwjwBRdIEWh_YT5_Sk6GK7M5cznIQc"
ADMIN_SECRET="PBEScalc!2026Sznt#Admin"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PBES — Apply Supabase Env Vars + Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Helper: upsert an env var (create or update) ─────────────────────────────
upsert_env() {
  local KEY="$1"
  local VALUE="$2"
  echo "▸ Setting $KEY..."

  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.vercel.com/v10/projects/${PROJECT_ID}/env" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"${KEY}\",\"value\":\"${VALUE}\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}")

  if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
    echo "  ✅ $KEY added"
    return
  fi

  if [ "$HTTP" = "400" ] || [ "$HTTP" = "409" ]; then
    # Already exists — find ID and PATCH
    ENV_ID=$(curl -s \
      "https://api.vercel.com/v10/projects/${PROJECT_ID}/env" \
      -H "Authorization: Bearer ${TOKEN}" \
      | python3 -c "import sys,json; envs=json.load(sys.stdin).get('envs',[]); print(next((e['id'] for e in envs if e['key']=='${KEY}'),''))" 2>/dev/null)

    if [ -n "$ENV_ID" ]; then
      curl -s -o /dev/null \
        -X PATCH "https://api.vercel.com/v10/projects/${PROJECT_ID}/env/${ENV_ID}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"value\":\"${VALUE}\",\"target\":[\"production\",\"preview\",\"development\"]}"
      echo "  ✅ $KEY updated (already existed)"
    else
      echo "  ⚠️  $KEY: could not find existing ID, skipping patch"
    fi
    return
  fi
  echo "  ⚠️  $KEY: unexpected HTTP $HTTP"
}

# ── Step 1: Add all Supabase env vars ─────────────────────────────────────────
upsert_env "SUPA_URL"         "$SUPA_URL"
upsert_env "SUPA_SERVICE_KEY" "$SUPA_SERVICE_KEY"
upsert_env "ADMIN_SECRET"     "$ADMIN_SECRET"

# ── Step 2: Check Supabase tables ─────────────────────────────────────────────
echo ""
echo "▸ Checking Supabase tables..."

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamxwYmZjYmV6d2lwcmx6dmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODg1NTYsImV4cCI6MjA5MTI2NDU1Nn0.xiBPDgvjh6JGmefhx2BXlB4PZr0QPTtOStrqAV8mXhc"

TABLE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPA_URL}/rest/v1/assessments?limit=1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}")

if [ "$TABLE_CHECK" = "200" ]; then
  echo "  ✅ Supabase tables already exist"
  SCHEMA_NEEDED=false
elif [ "$TABLE_CHECK" = "404" ] || [ "$TABLE_CHECK" = "400" ]; then
  echo "  ⚠️  Tables not found (HTTP $TABLE_CHECK)"
  SCHEMA_NEEDED=true
else
  echo "  ❓ Table check returned HTTP $TABLE_CHECK (continuing anyway)"
  SCHEMA_NEEDED=false
fi

if [ "$SCHEMA_NEEDED" = "true" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ACTION REQUIRED: Apply database schema"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  1. Open: https://supabase.com/dashboard/project/wcjlpbfcbezwiprlzvck/sql/new"
  echo "  2. Open the file: ${SCRIPT_DIR}/schema.sql"
  echo "  3. Copy-paste the entire contents into the SQL editor"
  echo "  4. Click Run"
  echo "  5. Re-run this script"
  echo ""
  open "https://supabase.com/dashboard/project/wcjlpbfcbezwiprlzvck/sql/new" 2>/dev/null
  rm -- "$0"
  exit 1
fi

# ── Step 3: Deploy ─────────────────────────────────────────────────────────────
echo ""
echo "▸ Deploying to Vercel..."
python3 "${SCRIPT_DIR}/deploy_vercel.py"

echo ""
read -n 1 -p "Press any key to close..."
rm -- "$0"
