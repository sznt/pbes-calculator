/**
 * /api/scrape-orcid — ORCID public API integration
 *
 * ORCID provides a completely FREE public API (no key required for public data).
 * Documentation: https://pub.orcid.org/v3.0/
 *
 * Extracts: name, works count, employment history, education, biography
 *
 * Accepts either:
 *   - Full ORCID URL:  https://orcid.org/0000-0002-1825-0097
 *   - Just the ORCID: 0000-0002-1825-0097
 *
 * Usage: GET /api/scrape-orcid?url=https://orcid.org/0000-0002-1825-0097
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'url parameter required' });

  // Extract ORCID ID (format: 0000-0000-0000-0000)
  const orcidMatch = url.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  if (!orcidMatch) {
    return res.status(400).json({
      success: false,
      error: 'Could not extract ORCID ID from URL. Format should be: 0000-0000-0000-0000',
      platform: 'ORCID'
    });
  }
  const orcidId = orcidMatch[1];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // ORCID public API — no auth needed, returns JSON
    const [personRes, worksRes, employRes] = await Promise.all([
      fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://pub.orcid.org/v3.0/${orcidId}/works`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://pub.orcid.org/v3.0/${orcidId}/employments`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      }),
    ]);
    clearTimeout(timeout);

    if (personRes.status === 404) {
      return res.json({
        success: false,
        error: 'ORCID profile not found. Check the ORCID ID.',
        platform: 'ORCID',
        signals: ['ORCID ID not found'],
        data: {}
      });
    }

    if (!personRes.ok) {
      return res.json({
        success: false,
        error: `ORCID API returned status ${personRes.status}`,
        platform: 'ORCID',
        signals: ['ORCID API error'],
        data: {}
      });
    }

    const person    = await personRes.json();
    const works     = worksRes.ok     ? await worksRes.json()  : null;
    const employ    = employRes.ok    ? await employRes.json() : null;

    // ── Name ────────────────────────────────────────────────────────────────
    const givenName  = person?.name?.['given-names']?.value  || '';
    const familyName = person?.name?.['family-name']?.value  || '';
    const creditName = person?.name?.['credit-name']?.value  || null;
    const fullName   = creditName || [givenName, familyName].filter(Boolean).join(' ') || null;

    // ── Biography ────────────────────────────────────────────────────────────
    const biography  = person?.biography?.content || null;

    // ── Works (publications) ─────────────────────────────────────────────────
    const workGroups = works?.group || [];
    const worksCount = workGroups.length;

    // Collect unique publication years to find career start
    const years = workGroups
      .map(g => g['work-summary']?.[0]?.['publication-date']?.year?.value)
      .filter(Boolean)
      .map(Number)
      .sort();
    const firstPublicationYear = years[0] ?? null;
    const recentPublicationYear = years[years.length - 1] ?? null;

    // Count DOIs (peer-reviewed)
    const doiCount = workGroups.filter(g =>
      g['work-summary']?.[0]?.['external-ids']?.['external-id']
        ?.some(eid => eid['external-id-type'] === 'doi')
    ).length;

    // ── Employment ───────────────────────────────────────────────────────────
    const employGroups = employ?.['affiliation-group'] || [];
    const currentEmployment = employGroups
      .map(g => g.summaries?.[0]?.['employment-summary'])
      .filter(e => e && !e['end-date'])  // no end date = current
      .map(e => ({
        org: e.organization?.name || null,
        role: e['role-title'] || null,
        dept: e['department-name'] || null,
      }));

    const primaryOrg  = currentEmployment[0]?.org  || null;
    const primaryRole = currentEmployment[0]?.role || null;

    // ── Keywords ─────────────────────────────────────────────────────────────
    const keywords = (person?.keywords?.keyword || [])
      .map(k => k.content)
      .filter(Boolean)
      .slice(0, 8);

    // ── Signals ──────────────────────────────────────────────────────────────
    const signals = [
      fullName     ? `ORCID: ${fullName}`                                             : null,
      primaryOrg   ? `${primaryRole ? primaryRole + ' at ' : ''}${primaryOrg}`       : null,
      worksCount   ? `${worksCount} works on ORCID`                                   : null,
      doiCount     ? `${doiCount} DOI-referenced publications`                        : null,
      firstPublicationYear ? `Publishing since ${firstPublicationYear}`               : null,
      keywords.length ? `Research areas: ${keywords.slice(0,3).join(', ')}`           : null,
    ].filter(Boolean);

    if (signals.length === 0) signals.push('ORCID profile found (no public works listed)');

    return res.json({
      success: true,
      platform: 'ORCID',
      signals,
      data: {
        orcidId,
        fullName,
        biography:            biography     ? biography.slice(0, 300) : null,
        worksCount:           worksCount    ?? null,
        doiCount:             doiCount      ?? null,
        firstPublicationYear: firstPublicationYear ?? null,
        recentPublicationYear:recentPublicationYear ?? null,
        primaryOrg:           primaryOrg    ?? null,
        primaryRole:          primaryRole   ?? null,
        keywords,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({
        success: false,
        error: 'ORCID API request timed out (10s)',
        platform: 'ORCID',
        signals: ['ORCID URL detected (timeout)'],
        data: {}
      });
    }
    return res.json({
      success: false,
      error: err.message,
      platform: 'ORCID',
      signals: ['ORCID URL detected'],
      data: {}
    });
  }
}
