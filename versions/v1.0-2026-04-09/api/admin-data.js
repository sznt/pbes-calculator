/**
 * /api/admin-data — Supabase admin endpoint (service_role key)
 *
 * This endpoint uses the Supabase SERVICE_ROLE key which bypasses RLS.
 * It should ONLY be called with the correct ADMIN_SECRET header.
 *
 * Endpoints:
 *   GET  /api/admin-data?action=stats            — aggregate statistics
 *   GET  /api/admin-data?action=assessments      — all assessments
 *   GET  /api/admin-data?action=users            — all users/profiles
 *   GET  /api/admin-data?action=orgs             — all organizations
 *   GET  /api/admin-data?action=intelligence     — dissertation-level intelligence
 *
 * Security: Requires X-Admin-Secret header matching ADMIN_SECRET env var.
 */

const SUPABASE_URL         = process.env.SUPA_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPA_SERVICE_KEY;  // service_role (never expose to frontend)
const ADMIN_SECRET         = process.env.ADMIN_SECRET || 'pbes2025admin';

// Minimal Supabase REST client (no SDK needed in Node)
async function supaQuery(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');

  // ── Authentication ────────────────────────────────────────────────────────
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Supabase not configured. Set SUPA_URL and SUPA_SERVICE_KEY environment variables.'
    });
  }

  const { action } = req.query;

  try {
    switch (action) {

      // ── Aggregate stats ──────────────────────────────────────────────────
      case 'stats': {
        const assessments = await supaQuery('assessments', '?select=archetype_key,industry,employment,seniority,pbe_w,ba,bd,br,is_peer,created_at&order=created_at.desc');

        const totalAssessments   = assessments.length;
        const selfAssessments    = assessments.filter(a => !a.is_peer).length;
        const peerAssessments    = assessments.filter(a =>  a.is_peer).length;

        // Archetype distribution
        const archetypeCount = {};
        assessments.forEach(a => {
          if (a.archetype_key) archetypeCount[a.archetype_key] = (archetypeCount[a.archetype_key] || 0) + 1;
        });

        // Industry distribution
        const industryCount = {};
        assessments.filter(a => a.industry).forEach(a => {
          industryCount[a.industry] = (industryCount[a.industry] || 0) + 1;
        });

        // Average scores
        const self = assessments.filter(a => !a.is_peer);
        const avg = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

        const avgBA  = avg(self.map(a => a.ba ).filter(x => x != null));
        const avgBD  = avg(self.map(a => a.bd ).filter(x => x != null));
        const avgBR  = avg(self.map(a => a.br ).filter(x => x != null));
        const avgPBE = avg(self.map(a => a.pbe_w).filter(x => x != null));

        return res.json({
          success: true,
          data: {
            totalAssessments, selfAssessments, peerAssessments,
            archetypeDistribution: archetypeCount,
            industryDistribution: industryCount,
            averageScores: { BA: avgBA, BD: avgBD, BR: avgBR, PBE: avgPBE },
          }
        });
      }

      // ── All assessments ───────────────────────────────────────────────────
      case 'assessments': {
        const assessments = await supaQuery(
          'assessments',
          '?select=*&order=created_at.desc&limit=500'
        );
        return res.json({ success: true, data: assessments });
      }

      // ── All users/profiles ─────────────────────────────────────────────────
      case 'users': {
        const profiles = await supaQuery('profiles', '?select=*&order=created_at.desc');
        return res.json({ success: true, data: profiles });
      }

      // ── All organizations ─────────────────────────────────────────────────
      case 'orgs': {
        const orgs = await supaQuery('organizations', '?select=*,org_members(count)&order=created_at.desc');
        return res.json({ success: true, data: orgs });
      }

      // ── Intelligence (dissertation-level analysis) ────────────────────────
      case 'intelligence': {
        const assessments = await supaQuery(
          'assessments',
          '?select=ba,bd,br,bi,pbe_w,pbe_r,archetype_key,industry,employment,seniority,is_peer,created_at&is_peer=eq.false&order=created_at.desc'
        );

        if (assessments.length === 0) {
          return res.json({ success: true, data: { message: 'No assessments yet', count: 0 } });
        }

        const avg = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
        const sd  = (arr, mean) => arr.length < 2 ? 0 :
          Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1));

        const bas = assessments.map(a => a.ba).filter(x => x != null);
        const bds = assessments.map(a => a.bd).filter(x => x != null);
        const brs = assessments.map(a => a.br).filter(x => x != null);
        const pbes = assessments.map(a => a.pbe_w).filter(x => x != null);

        const baAvg = avg(bas);
        const bdAvg = avg(bds);
        const brAvg = avg(brs);
        const pbeAvg = avg(pbes);

        // Pearson correlation helper
        const pearson = (xs, ys) => {
          if (xs.length !== ys.length || xs.length < 2) return null;
          const mx = avg(xs), my = avg(ys);
          const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
          const den = Math.sqrt(
            xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
            ys.reduce((s, y) => s + (y - my) ** 2, 0)
          );
          return den === 0 ? 0 : num / den;
        };

        // Correlations (dissertation benchmarks: BA→BD=0.781, BA→BR=0.376, BD→BR=0.347)
        const correlations = {
          BA_BD: pearson(bas, bds),
          BA_BR: pearson(bas, brs),
          BD_BR: pearson(bds, brs),
        };

        // Industry breakdown
        const industries = {};
        assessments.forEach(a => {
          if (!a.industry) return;
          if (!industries[a.industry]) industries[a.industry] = { bas: [], bds: [], brs: [], pbes: [], count: 0 };
          industries[a.industry].bas.push(a.ba);
          industries[a.industry].bds.push(a.bd);
          industries[a.industry].brs.push(a.br);
          if (a.pbe_w) industries[a.industry].pbes.push(a.pbe_w);
          industries[a.industry].count++;
        });
        const industryStats = Object.entries(industries).map(([industry, d]) => ({
          industry,
          count: d.count,
          avgBA: avg(d.bas.filter(x => x != null)),
          avgBD: avg(d.bds.filter(x => x != null)),
          avgBR: avg(d.brs.filter(x => x != null)),
          avgPBE: avg(d.pbes),
        })).sort((a, b) => b.count - a.count);

        // Seniority breakdown
        const seniorities = {};
        assessments.forEach(a => {
          if (!a.seniority) return;
          if (!seniorities[a.seniority]) seniorities[a.seniority] = { pbes: [], count: 0 };
          if (a.pbe_w) seniorities[a.seniority].pbes.push(a.pbe_w);
          seniorities[a.seniority].count++;
        });
        const seniorityStats = Object.entries(seniorities).map(([seniority, d]) => ({
          seniority,
          count: d.count,
          avgPBE: avg(d.pbes),
        }));

        // Archetype distribution
        const archetypeCount = {};
        assessments.forEach(a => {
          if (a.archetype_key) archetypeCount[a.archetype_key] = (archetypeCount[a.archetype_key] || 0) + 1;
        });

        // Score distribution (for histogram)
        const distribution = { BA: {}, BD: {}, BR: {}, PBE: {} };
        [[bas, 'BA'], [bds, 'BD'], [brs, 'BR'], [pbes, 'PBE']].forEach(([arr, key]) => {
          [0,10,20,30,40,50,60,70,80,90].forEach(bucket => {
            distribution[key][`${bucket}-${bucket+10}`] = arr.filter(v => v >= bucket && v < bucket + 10).length;
          });
        });

        return res.json({
          success: true,
          data: {
            count: assessments.length,
            overallAverages: { BA: baAvg, BD: bdAvg, BR: brAvg, PBE: pbeAvg },
            standardDeviations: {
              BA: sd(bas, baAvg),
              BD: sd(bds, bdAvg),
              BR: sd(brs, brAvg),
            },
            correlations,
            dissertationBenchmarks: { BA_BD: 0.781, BA_BR: 0.376, BD_BR: 0.347 },
            industryBreakdown: industryStats,
            seniorityBreakdown: seniorityStats,
            archetypeDistribution: archetypeCount,
            scoreDistribution: distribution,
          }
        });
      }

      default:
        return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    }

  } catch (err) {
    console.error('[admin-data]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
