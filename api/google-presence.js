/**
 * /api/google-presence — Web presence analysis by name + industry
 *
 * Searches DuckDuckGo (free, no key) and Bing HTML (no key) for a person's name
 * combined with their industry. Analyzes the results to estimate online visibility,
 * content authority, and brand recognition signals.
 *
 * What it detects:
 *   - Number of indexed results mentioning the name + industry
 *   - LinkedIn profile presence in top results
 *   - Wikipedia presence (strong Brand Recognition signal)
 *   - Press coverage / news articles
 *   - Academic papers or conference appearances
 *   - Speaker profiles, podcast appearances
 *   - Own website or blog
 *   - Social media profiles in top results
 *
 * These signals map to PBES dimensions:
 *   - Wide web presence → BR (Brand Recognition)
 *   - Expert mentions, publications → BD (Brand Differentiation)
 *   - Press, Wikipedia, keynote profiles → BR + BA (Brand Appeal)
 *
 * Usage: GET /api/google-presence?name=Péter+Szántó&industry=Research+%26+Academia
 */

// ── Source classification for PBES scoring ───────────────────────────────────
const SOURCE_RULES = [
  // High BR signals
  { pattern: /wikipedia\.org/i,                   label: 'Wikipedia article',        dimension: 'BR', weight: 3 },
  { pattern: /forbes\.com|businessinsider/i,       label: 'Major press coverage',     dimension: 'BR', weight: 3 },
  { pattern: /ted\.com\/talks/i,                   label: 'TED Talk',                 dimension: 'BR', weight: 3 },
  { pattern: /bbc\.|cnn\.|reuters\.|ft\.com/i,     label: 'International press',      dimension: 'BR', weight: 3 },
  { pattern: /\bpodcast\b|\bepisode\b/i,           label: 'Podcast appearance',       dimension: 'BR', weight: 2 },
  { pattern: /speaker|keynote|conference/i,        label: 'Conference speaker',       dimension: 'BR', weight: 2 },
  // BD signals
  { pattern: /scholar\.google|pubmed|arxiv|jstor/i, label: 'Academic publication',   dimension: 'BD', weight: 3 },
  { pattern: /doi\.org|researchgate|orcid/i,        label: 'Research profile/paper',  dimension: 'BD', weight: 2 },
  { pattern: /interview|expert|author of/i,         label: 'Expert mention',          dimension: 'BD', weight: 2 },
  { pattern: /book|publisher|amazon\.com\/dp/i,     label: 'Published book',          dimension: 'BD', weight: 3 },
  // LinkedIn / professional
  { pattern: /linkedin\.com\/in\//i,               label: 'LinkedIn profile',         dimension: 'BA', weight: 1 },
  { pattern: /linkedin\.com\/pub\//i,              label: 'LinkedIn profile',         dimension: 'BA', weight: 1 },
  // Own website / blog
  { pattern: /(?:^|\s)(blog|about me|portfolio)/i, label: 'Personal website/blog',   dimension: 'BA', weight: 1 },
  // Social
  { pattern: /twitter\.com|x\.com/i,              label: 'Twitter/X profile',        dimension: 'BR', weight: 1 },
  { pattern: /youtube\.com\/@/i,                  label: 'YouTube channel',           dimension: 'BR', weight: 1 },
  { pattern: /instagram\.com\//i,                 label: 'Instagram profile',         dimension: 'BR', weight: 1 },
  // News / media
  { pattern: /news|press release|pr.com/i,        label: 'News/press mention',        dimension: 'BR', weight: 2 },
  // University / institution
  { pattern: /\.edu\/|university|faculty|professor/i, label: 'Academic institution',  dimension: 'BD', weight: 2 },
  // Industry-specific
  { pattern: /crunchbase\.|angellist\./i,         label: 'Startup/investor profile',  dimension: 'BD', weight: 2 },
];

function classifyUrl(url, snippet) {
  const combined = (url + ' ' + snippet).toLowerCase();
  for (const rule of SOURCE_RULES) {
    if (rule.pattern.test(combined)) return rule;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { name, industry } = req.query;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'name parameter required (minimum 2 characters)' });
  }

  const cleanName     = name.trim();
  const cleanIndustry = (industry || '').trim();

  // Build search queries
  const queries = [
    `"${cleanName}"${cleanIndustry ? ' ' + cleanIndustry : ''}`,
    `"${cleanName}" professional`,
  ];

  const allResults = [];
  const errors     = [];

  // ── Try DuckDuckGo Instant Answer API ─────────────────────────────────────
  // Free, no key, returns structured JSON (but limited to instant answers)
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(queries[0])}&format=json&no_redirect=1&no_html=1&skip_disambig=1`,
      {
        headers: { 'User-Agent': 'PersonalBrandCalculator/1.0' },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (ddgRes.ok) {
      const ddg = await ddgRes.json();
      if (ddg.Abstract) {
        allResults.push({
          url:     ddg.AbstractURL || '',
          title:   ddg.Heading     || cleanName,
          snippet: ddg.Abstract,
          source:  'DuckDuckGo Knowledge Panel',
        });
      }
      (ddg.RelatedTopics || []).slice(0, 8).forEach(t => {
        if (t.FirstURL && t.Text) {
          allResults.push({ url: t.FirstURL, title: t.Text.slice(0, 80), snippet: t.Text, source: 'DDG Related' });
        }
      });
      (ddg.Results || []).forEach(r => {
        if (r.FirstURL) allResults.push({ url: r.FirstURL, title: r.Text?.slice(0,80)||'', snippet: r.Text||'', source: 'DDG Result' });
      });
    }
  } catch (e) { errors.push('DuckDuckGo: ' + e.message); }

  try {
    const bingQuery = encodeURIComponent(queries[0]);
    const bingRes = await fetch(
      `https://www.bing.com/search?q=${bingQuery}&count=20&form=QBLH`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (bingRes.ok) {
      const html = await bingRes.text();
      const countMatch = html.match(/([0-9,1]+)\s+results/i,);
      if (countMatch) allResults.push({ _resultCount: parseInt(countMatch[1].replace(/,/g, ''), 10) });
      const resultBlocks = [...html.matchAll(/<h2><a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g)];
      resultBlocks.slice(0, 15).forEach(m => {
        const url = m[1], title = m[2].replace(/<[^>]+>/g, '').trim(), snippet = m[3].replace(/<[^>]+>/g, '').trim();
        if (url && !url.startsWith('javascript') && title) allResults.push({ url, title, snippet, source: 'Bing' });
      });
    }
  } catch (e) { errors.push('Bing: ' + e.message); }

  const resultCount = allResults.find(r => r._resultCount)?._resultCount || null;
  const webResults  = allResults.filter(r => !r._resultCount && r.url);
  const found = [], dimensions = { BA: 0, BD: 0, BR: 0 }, seenLabels = new Set();
  for (const r of webResults) {
    const match = classifyUrl(r.url, r.title + ' ' + r.snippet);
    if (match && !seenLabels.has(match.label)) {
      seenLabels.add(match.label);
      found.push({ label: match.label, url: r.url, dimension: match.dimension, weight: match.weight });
      dimensions[match.dimension] = (dimensions[match.dimension] || 0) + match.weight;
    }
  }
  const baBoost = Math.min(dimensions.BA * 3, 15);
  const bdBoost = Math.min(dimensions.BD * 4, 15);
  const brBoost = Math.min(dimensions.BR * 4, 15);
  let presenceTier;
  const totalWeight = Object.values(dimensions).reduce((s, v) => s + v, 0);
  if (totalWeight >= 8 || (resultCount && resultCount > 50000)) presenceTier = 'High';
  else if (totalWeight >= 3 || (resultCount && resultCount > 5000)) presenceTier = 'Moderate';
  else if (totalWeight >= 1 || (resultCount && resultCount > 500)) presenceTier = 'Low';
  else presenceTier = 'Minimal';
  const signals = [];
  if (resultCount) signals.push(`~${resultCount.toLocaleString()} web results for "${cleanName}"`);
  if (presenceTier) signals.push(`Online presence tier: ${presenceTier}`);
  found.forEach(f => signals.push(`${f.label} found`));
  if (signals.length === 0) signals.push(`No strong online presence found for "${cleanName}" in ${cleanIndustry || 'this field'}`);
  return res.json({ success: true, platform: 'Web Presence', signals, data: { name: cleanName, industry: cleanIndustry || null, resultCount: resultCount ?? null, presenceTier, found, scoringBoosts: { BA: baBoost, BD: bdBoost, BR: brBoost }, errors: errors.length ? errors : undefined } });
}
