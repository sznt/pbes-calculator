#!/usr/bin/env python3
"""
Seed the Supabase assessments table with 340 dissertation questionnaire responses.
Run once: double-click this file.
Self-deletes after successful seeding.
"""
import sys, os, json, urllib.request, urllib.error
sys.path.insert(0, '/usr/lib/python3')

try:
    import openpyxl
except ImportError:
    os.system('pip install openpyxl --break-system-packages -q')
    import openpyxl

SUPA_URL = "https://wcjlpbfcbezwiprlzvck.supabase.co"
SUPA_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamxwYmZjYmV6d2lwcmx6dmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY4ODU1NiwiZXhwIjoyMDkxMjY0NTU2fQ.6wMHOLA25RXDuvwjwBRdIEWh_YT5_Sk6GK7M5cznIQc"
HEADERS   = {
    "apikey":        SUPA_KEY,
    "Authorization": f"Bearer {SUPA_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal"
}

XLSX = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    "../PhD/Disszertáció/Kutatás/Kérdőív/Personal Brand Equity (Responses) CALCULATION GOOD.xlsx")

# ── Column index mapping (0-based from row tuple) ────────────────────────────
# BA: Brand Appeal (cols 1,3,4,5,6,8,9,11) → Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8
BA_COLS = [1, 3, 4, 5, 6, 8, 9, 11]
# BD: Brand Differentiation (cols 13,14,16,18,19,20,23,25)
BD_COLS = [13, 14, 16, 18, 19, 20, 23, 25]
# BR: Brand Recognition (cols 27,28,29,30,31,32,26,35)
BR_COLS = [27, 28, 29, 30, 31, 32, 26, 35]
# Reversed items (high raw → low score): negate before averaging
REVERSED = {12, 24, 33, 34}  # 0-based column indices

# Demographics
COL_EMPLOYMENT = 38
COL_AGE        = 37
COL_EXPERIENCE = 39
COL_GENDER     = 40
COL_EDUCATION  = 42
COL_INDUSTRY   = 43
COL_ROLE       = 44

# ── Demographic mappers ───────────────────────────────────────────────────────
INDUSTRY_MAP = {
    'Finance and Insurance':             'Finance & Banking',
    'IT, Information Services, Data Processing': 'Technology',
    'Software':                          'Technology',
    'Broadcasting, Media, Publishing':   'Marketing & Media',
    'Broadcasting, Media, Marketing, Publishing': 'Marketing & Media',
    'Arts, Entertainment, and Recreation': 'Marketing & Media',
    'Education':                         'Education',
    'Health Care':                       'Healthcare',
    'Social Services':                   'Healthcare',
    'Legal Services':                    'Consulting',
    'Consultatnt':                       'Consulting',
    'Consultant':                        'Consulting',
    'Manufacturing':                     'Engineering',
    'Construction':                      'Engineering',
    'Telecommunications':                'Technology',
    'Real Estate, Rental and Leasing':   'Other',
    'Retail':                            'Other',
    'Wholesale':                         'Other',
    'Hotel, Food and Travel services':   'Other',
    'Transportation':                    'Other',
    'Public Services, Government':       'Other',
    'Other':                             'Other',
}

EMPLOYMENT_MAP = {
    'Full-time employment at an organization': 'Full-time Employee',
    'Part time employment at an organization': 'Part-time Employee',
    'Entrepreneur or Self-employed':           'Founder / Self-employed',
    'Student':                                 'Student',
    'Unemployed and looking for work':         'Other',
    'Unemployed and not looking for work':     'Other',
}

SENIORITY_MAP = {
    'Student':                  'Student / Entry',
    'Junior Management':        'Individual Contributor',
    'Administrative, Support Staff': 'Individual Contributor',
    'Temporary Employee':       'Individual Contributor',
    'Middle Management':        'Manager',
    'Entrepreneur':             'Founder / Executive',
    'Self-employed':            'Founder / Executive',
    'Upper Management':         'Founder / Executive',
    'Consultatnt':              'Manager',
    'Consultant':               'Manager',
    'Researcher':               'Individual Contributor',
    'Other':                    'Other',
}

def normalize(raw, reversed_item=False):
    """Convert Likert 1-5 to 0-100. Reversed items are flipped."""
    try:
        v = float(raw)
        if reversed_item:
            v = 6 - v   # flip: 1→5, 5→1
        return round((v - 1) / 4 * 100, 2)
    except (TypeError, ValueError):
        return None

def row_to_record(row):
    """Convert one respondent row → assessment dict for Supabase."""
    # Score each dimension
    ba_scores, bd_scores, br_scores = [], [], []

    for c in BA_COLS:
        v = normalize(row[c], c in REVERSED)
        if v is not None: ba_scores.append(v)

    for c in BD_COLS:
        v = normalize(row[c], c in REVERSED)
        if v is not None: bd_scores.append(v)

    for c in BR_COLS:
        v = normalize(row[c], c in REVERSED)
        if v is not None: br_scores.append(v)

    if not ba_scores or not bd_scores or not br_scores:
        return None

    ba = round(sum(ba_scores) / len(ba_scores), 2)
    bd = round(sum(bd_scores) / len(bd_scores), 2)
    br = round(sum(br_scores) / len(br_scores), 2)
    pbe_w = round(ba * 0.45 + bd * 0.35 + br * 0.20, 2)

    # Archetype (H ≥ 60, L < 60)
    h = lambda x: 'H' if x >= 60 else 'L'
    archetype = h(ba) + h(bd) + h(br)

    # Demographics
    industry  = INDUSTRY_MAP.get(row[COL_INDUSTRY], 'Other') if row[COL_INDUSTRY] else None
    employment= EMPLOYMENT_MAP.get(row[COL_EMPLOYMENT], 'Other') if row[COL_EMPLOYMENT] else None
    seniority = SENIORITY_MAP.get(row[COL_ROLE], 'Other') if row[COL_ROLE] else None

    return {
        "user_id":      None,
        "name":         "Dissertation Study Participant",
        "title":        str(row[COL_ROLE])   if row[COL_ROLE]   else None,
        "industry":     industry,
        "employment":   employment,
        "seniority":    seniority,
        "ba":           ba,
        "bd":           bd,
        "br":           br,
        "pbe_w":        pbe_w,
        "archetype_key":archetype,
        "is_peer":      False,
        "source":       "dissertation_2023",
    }

def supabase_insert_batch(records):
    body = json.dumps(records).encode()
    req  = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/assessments",
        data=body, headers=HEADERS, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def main():
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  Seeding dissertation data → Supabase")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    # ── Check if already seeded ───────────────────────────────────────────────
    check_req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/assessments?source=eq.dissertation_2023&select=id&limit=1",
        headers=HEADERS, method="GET"
    )
    try:
        with urllib.request.urlopen(check_req) as r:
            existing = json.loads(r.read())
            if existing:
                print(f"  ℹ️  Dissertation data already seeded ({len(existing)}+ records found).")
                print("  To re-seed, delete records with source='dissertation_2023' in Supabase first.\n")
                input("Press Enter to exit...")
                os.remove(__file__)
                return
    except Exception as e:
        # 'source' column might not exist yet — continue and it will fail gracefully
        pass

    if not os.path.exists(XLSX):
        print(f"  ❌ Excel file not found at:\n     {XLSX}")
        input("\nPress Enter to exit...")
        return

    # ── Read Excel ────────────────────────────────────────────────────────────
    print(f"  Reading: {os.path.basename(XLSX)}")
    wb   = openpyxl.load_workbook(XLSX, data_only=True)
    rows = list(wb.active.iter_rows(values_only=True))[1:]  # skip header
    print(f"  Rows found: {len(rows)}")

    # ── Build records ─────────────────────────────────────────────────────────
    records = []
    skipped = 0
    for row in rows:
        r = row_to_record(row)
        if r:
            records.append(r)
        else:
            skipped += 1

    print(f"  Valid records: {len(records)}  Skipped (incomplete): {skipped}")

    # ── Insert in batches of 50 ───────────────────────────────────────────────
    BATCH = 50
    total = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i+BATCH]
        status, err = supabase_insert_batch(batch)
        if status in (200, 201):
            total += len(batch)
            print(f"  ✅ Inserted {total}/{len(records)} records")
        else:
            print(f"  ❌ Batch {i//BATCH+1} failed (HTTP {status}): {err[:200]}")
            if 'source' in err:
                print("\n  ⚠️  The 'source' column doesn't exist yet.")
                print("  Please run schema_additions.sql in Supabase SQL Editor first,")
                print("  then re-run this script.")
            break

    if total == len(records):
        print(f"\n  ✅ Successfully seeded {total} dissertation respondents into Supabase!")
        print("  The benchmark section will now show real academic data.\n")

    input("Press Enter to exit...")
    try: os.remove(__file__)
    except: pass

if __name__ == '__main__':
    main()
