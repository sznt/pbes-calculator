/**
 * /api/scrape-scholar — Google Scholar public profile scraper
 *
 * Fetches a Google Scholar public author profile and extracts:
 * - Total citations, h-index, i10-index
 * - Paper count (visible on first page)
 * - Author name and affiliation
 *
 * Google Scholar has no official free API. This parses the HTML directly.
 * Works for profiles that are set to "Public" (default for most authors).
 *
 * Usage: GET /api/scrape-scholar?url=https://scholar.google.com/citations?user=XXXX
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

  let profileUrl = url;
  if (!profileUrl.startsWith('http')) profileUrl = 'https://' + profileUrl;

  // Ensure we request English page and public view
  if (!profileUrl.includes('hl=')) {
    profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'hl=en';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(profileUrl, {
      signal: controller.signal,
      headers: {
        // Googlebot user agent is more likely to get full HTML without JS challenge
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await response.text();

    // Detect CAPTCHA / bot block
    if (
      html.includes('unusual traffic') ||
      html.includes('captcha') ||
      html.includes('recaptcha') ||
      html.includes('Our systems have detected') ||
      (response.status === 429 || response.status === 503)
    ) {
      return res.json({
        success: false,
        blocked: true,
        platform: 'Google Scholar',
        message: 'Google Scholar is temporarily blocking automated requests. Please try again later.',
        signals: ['Scholar URL detected (temporarily blocked)'],
        data: {}
      });
    }

    // ── Author name ────────────────────────────────────────────────────────
    const nameMatch = html.match(/id="gsc_prf_in"[^>]*>([^<]+)/);
    const authorName = nameMatch ? nameMatch[1].trim() : null;

    // ── Affiliation ────────────────────────────────────────────────────────
    const affiliationMatch = html.match(/class="gsc_prf_il"[^>]*>([^<]+)/);
    const affiliation = affiliationMatch ? affiliationMatch[1].trim() : null;

    // ── Citation stats ─────────────────────────────────────────────────────
    // Scholar renders a stats table with class="gsc_rsb_std"
    // Row order: Citations (all), Citations (since year), h-index (all), h-index (since), i10-index (all), i10-index (since)
    const statsMatches = [...html.matchAll(/class="gsc_rsb_std">(\d[\d,]*)</g)];
    const stats = statsMatches.map(m => parseInt(m[1].replace(/,/g, ''), 10));

    const totalCitations = stats[0] ?? null;
    const hIndex        = stats[2] ?? null;
    const i10Index      = stats[4] ?? null;

    // ── Paper count ────────────────────────────────────────────────────────
    // Each paper row has class="gsc_a_t"
    const paperMatches = html.match(/class="gsc_a_t"/g);
    const paperCount = paperMatches ? paperMatches.length : null;

    // ── Verified email domain ──────────────────────────────────────────────
    const verifiedMatch = html.match(/Verified email at ([^\s<"]+)/i);
    const verifiedEmail = verifiedMatch ? verifiedMatch[1] : null;

    const signals = [
      authorName       ? `Scholar: ${authorName}`                                : null,
      totalCitations   ? `${totalCitations.toLocaleString()} total citations`    : null,
      hIndex           ? `h-index: ${hIndex}`                                    : null,
      i10Index         ? `i10-index: ${i10Index}`                                : null,
      paperCount       ? `${paperCount}+ papers visible`                         : null,
      verifiedEmail    ? `Verified at ${verifiedEmail}`                          : null,
    ].filter(Boolean);

    if (signals.length === 0) {
      signals.push('Google Scholar profile URL detected (no public data found)');
    }

    return res.json({
      success: true,
      platform: 'Google Scholar',
      signals,
      data: {
        authorName,
        affiliation,
        totalCitations: totalCitations ?? null,
        hIndex:         hIndex         ?? null,
        i10Index:       i10Index       ?? null,
        paperCount:     paperCount     ?? null,
        verifiedEmail:  verifiedEmail  ?? null,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({
        success: false,
        error: 'Google Scholar request timed out (10s)',
        platform: 'Google Scholar',
        signals: ['Scholar URL detected (timeout)'],
        data: {}
      });
    }
    return res.json({
      success: false,
      error: err.message,
      platform: 'Google Scholar',
      signals: ['Scholar URL detected'],
      data: {}
    });
  }
}
