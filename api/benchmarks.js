/**
 * /api/benchmarks — Live benchmark averages from Supabase assessments
 *
 * GET /api/benchmarks?industry=Technology&seniority=Manager
 * GET /api/benchmarks?all=1   (global averages)
 *
 * Returns: { n, avgBA, avgBD, avgBR, avgPBE, byIndustry, bySeniority, archetypeDistribution }
 */

const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_SERVICE_KEY;

async function query(params = '') {
  const url = `${SUPA_URL}/rest/v1/assessments?is_peer=eq.false${params}&select=ba,bd,br,pbe_w,archetype_key,industry,seniority`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
}

const avg = arr => arr.length ? Math.round(arr.reduce((s,x)=>s+x,0)/arr.length*10)/10 : null;

function computeStats(rows) {
  const bas  = rows.map(r=>r.ba ).filter(x=>x!=null);
  const bds  = rows.map(r=>r.bd ).filter(x=>x!=null);
  const brs  = rows.map(r=>r.br ).filter(x=>x!=null);
  const pbes = rows.map(r=>r.pbe_w).filter(x=>x!=null);
  return { n: rows.length, avgBA: avg(bas), avgBD: avg(bds), avgBR: avg(brs), avgPBE: avg(pbes) };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 hour

  if (!SUPA_URL || !SUPA_KEY) {
    // Return static dissertation benchmarks as fallback
    return res.status(200).json({
      source: 'static',
      global: { n: 340, avgBA: 68.4, avgBD: 70.1, avgBR: 47.8, avgPBE: 62.3 },
      byIndustry: {
        'Finance & Banking':  { n:46,  avgBA:71.8, avgBD:72.5, avgBR:50.5, avgPBE:65.8 },
        'Technology':         { n:41,  avgBA:60.8, avgBD:66.5, avgBR:46.5, avgPBE:58.9 },
        'Marketing & Media':  { n:33,  avgBA:67.5, avgBD:68.5, avgBR:52.5, avgPBE:63.1 },
        'Education':          { n:18,  avgBA:65.0, avgBD:67.0, avgBR:46.0, avgPBE:60.0 },
        'Healthcare':         { n:17,  avgBA:66.2, avgBD:68.8, avgBR:44.2, avgPBE:61.1 },
      },
      bySeniority: {
        'Student / Entry':      { n:90,  avgPBE:53.2 },
        'Individual Contributor':{ n:107, avgPBE:61.4 },
        'Manager':              { n:41,  avgPBE:67.8 },
        'Founder / Executive':  { n:46,  avgPBE:72.1 },
      },
    });
  }

  try {
    // ── Fetch all non-peer assessments ────────────────────────────────────────
    const all = await query();

    const global = computeStats(all);

    // ── By industry ───────────────────────────────────────────────────────────
    const industryGroups = {};
    all.filter(r=>r.industry).forEach(r=>{
      if(!industryGroups[r.industry]) industryGroups[r.industry]=[];
      industryGroups[r.industry].push(r);
    });
    const byIndustry = {};
    Object.entries(industryGroups).forEach(([ind,rows])=>{
      if(rows.length>=5) byIndustry[ind]=computeStats(rows); // min 5 for stats
    });

    // ── By seniority ──────────────────────────────────────────────────────────
    const seniorityGroups = {};
    all.filter(r=>r.seniority).forEach(r=>{
      if(!seniorityGroups[r.seniority]) seniorityGroups[r.seniority]=[];
      seniorityGroups[r.seniority].push(r);
    });
    const bySeniority = {};
    Object.entries(seniorityGroups).forEach(([s,rows])=>{
      if(rows.length>=5) bySeniority[s]=computeStats(rows);
    });

    // ── Archetype distribution ─────────────────────────────────────────────────
    const archDist = {};
    all.filter(r=>r.archetype_key).forEach(r=>{
      archDist[r.archetype_key]=(archDist[r.archetype_key]||0)+1;
    });

    // ── Live vs dissertation split ────────────────────────────────────────────
    const liveOnly  = await query('&source=is.null');
    const seedOnly  = await query('&source=eq.dissertation_2023');

    return res.status(200).json({
      source:   'live',
      global,
      byIndustry,
      bySeniority,
      archetypeDistribution: archDist,
      meta: {
        totalAssessments:       all.length,
        liveUserAssessments:    liveOnly.length,
        dissertationSeeded:     seedOnly.length,
      }
    });

  } catch (err) {
    console.error('[benchmarks]', err);
    // Return static fallback on error
    return res.status(200).json({
      source: 'static_fallback',
      error:  err.message,
      global: { n: 340, avgBA: 68.4, avgBD: 70.1, avgBR: 47.8, avgPBE: 62.3 },
      byIndustry: {
        'Finance & Banking':  { n:46,  avgBA:71.8, avgBD:72.5, avgBR:50.5, avgPBE:65.8 },
        'Technology':         { n:41,  avgBA:60.8, avgBD:66.5, avgBR:46.5, avgPBE:58.9 },
        'Marketing & Media':  { n:33,  avgBA:67.5, avgBD:68.5, avgBR:52.5, avgPBE:63.1 },
        'Education':          { n:18,  avgBA:65.0, avgBD:67.0, avgBR:46.0, avgPBE:60.0 },
        'Healthcare':         { n:17,  avgBA:66.2, avgBD:68.8, avgBR:44.2, avgPBE:61.1 },
      },
    });
  }
}
