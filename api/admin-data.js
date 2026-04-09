/**
 * /api/admin-data — Supabase admin endpoint (service_role key)
 *
 * This endpoint uses the Supabase SERVICE_ROLE key which bypasses RLS.
 * It should ONLY be called with the correct ADMIN_SECRET header.
 */

const SUPABASE_URL = process.env.SUPA_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPA_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'pbes2025admin';
async function supaQuery(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const { action } = req.query;
  try {
    if (action === 'stats') { const d = await supaQuery('assessments','?select=archetype_key,industry,pbe_w,ba,bd,br,is_peer'); return res.json({success: true, data: {total: d.length}}); }
    if (action === 'assessments') { const d = await supaQuery('assessments','?order=created_at.desc&limit=500'); return res.json({success: true, data: d}); }
    if (action === 'users') { const d = await supaQuery('profiles','?order=created_at.desc'); return res.json({success: true, data: d}); }
    if (action === 'orgs') { const d = await supaQuery('organizations','?order=created_at.desc'); return res.json({success: true, data: d}); }
    return res.status(400).json({error: `Unknown action: ${action}`});
  } catch(err) { return res.status(500).json({error: err.message}); }
}
