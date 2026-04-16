/**
 * /api/scrape-researchgate — ResearchGate public profile scraper
 *
 * ResearchGate has no public API, so we parse HTML directly.
 * Extracts: research interest score, publications, citations, reads, followers
 *
 * NOTE: ResearchGate aggressively blocks bots with Cloudflare.
 * Results are best-effort. If blocked, graceful fallback is returned.
 *
 * Usage: GET /api/scrape-researchgate?url=https://www.researchgate.net/profile/Name-Surname
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
  if (!profileUrl.startsWith('http')) profileUrl = 'https://www.researchgate.net/profile/' + url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(profileUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await response.text();

    // Detect Cloudflare block
    if (
      response.status === 403 ||
      response.status === 503 ||
      html.includes('cf-browser-verification') ||
      html.includes('challenge-platform') ||
      html.includes('Just a moment') ||
      html.includes('_cf_chl_opt')
    ) {
      return res.json({
        success: false,
        blocked: true,
        platform: 'ResearchGate',
        message: 'ResearchGate is currently blocking automated requests (Cloudflare protection). Try again later.',
        signals: ['ResearchGate URL detected (access blocked)'],
        data: {}
      });
    }

    // Detect login wall
    if (html.includes('sign-up') && html.includes('Log in') && !html.includes('research-interest-score')) {
      return res.json({
        success: false,
        requiresLogin: true,
        platform: 'ResearchGate',
        message: 'ResearchGate profile requires login to view fully.',
        signals: ['ResearchGate URL detected (login required)'],
        data: {}
      });
    }

    const num = str => str ? parseInt(str.replace(/[,.\s]/g, ''), 10) || null : null;
    const numFloat = str => str ? parseFloat(str.replace(/,/g, '')) || null : null;

    // ── Author name ────────────────────────────────────────────────────────
    const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/) ||
                      html.match(/og:title.*?content="([^"]+)"/);
    const authorName = nameMatch ? nameMatch[1].replace(' | ResearchGate', '').trim() : null;

    // ── Research Interest Score ────────────────────────────────────────────
    const risMatch = html.match(/research.interest.score[^>]*>[\s]*([0-9,.]+)/i) ||
                     html.match(/RIS[^>]*>[^0-9]*([0-9,]+\.[0-9]+)/i);
    const researchInterestScore = risMatch ? numFloat(risMatch[1]) : null;

    // ── Publications count ────────────────────────────────────────────────
    const pubPatterns = [
      html.match(/(\d[\d,]+)\s*(?:Research\s*)?[Pp]ublications?/),
      html.match(/"publicationCount"\s*:\s*(\d+)/),
      html.match(/Publications\s*\((\d+)\)/),
    ].filter(Boolean);
    const publications = pubPatterns.length ? num(pubPatterns[0][1]) : null;

    // ── Citations ─────────────────────────────────────────────────────────
    const citPatterns = [
      html.match(/(\d[\d,]+)\s*[Cc]itations?/),
      html.match(/"citationCount"\s*:\s*(\d+)/),
      html.match(/Citations\s*\((\d+)\)/),
    ].filter(Boolean);
    const citations = citPatterns.length ? num(citPatterns[0][1]) : null;

    // ── Reads ─────────────────────────────────────────────────────────────
    const readPatterns = [
      html.match(/(\d[\d,]+)\s*[Rr]eads?/),
      html.match(/"readCount"\s*:\s*(\d+)/),
    ].filter(Boolean);
    const reads = readPatterns.length ? num(readPatterns[0][1]) : null;

    // ── Followers ─────────────────────────────────────────────────────────
    const followerPatterns = [
      html.match(/(\d[\d,]+)\s*[Ff]ollowers?/),
      html.match(/"followerCount"\s*:\s*(\d+)/),
    ].filter(Boolean);
    const followers = followerPatterns.length ? num(followerPatterns[0][1]) : null;

    // ── h-index from meta or inline ────────────────────────────────────────
    const hMatch = html.match(/h-?index[^>]*>[\s]*(\d+)/i) ||
                   html.match(/"hIndex"\s*:\s*(\d+)/i);
    const hIndex = hMatch ? num(hMatch[1]) : null;

    // ── Signals ───────────────────────────────────────────────────────────
    const signals = [
      authorName             ? `ResearchGate: ${authorName}`                              : null,
      publications           ? `${publications} publications`                              : null,
      citations              ? `${citations.toLocaleString()} citations`                  : null,
      reads                  ? `${reads.toLocaleString()} reads`                          : null,
      followers              ? `${followers.toLocaleString()} followers`                  : null,
      hIndex                 ? `h-index: ${hIndex}`                                       : null,
      researchInterestScore  ? `Research Interest Score: ${researchInterestScore}`        : null,
    ].filter(Boolean);

    if (signals.length === 0) {
      signals.push('ResearchGate profile found (limited public data)');
    }

    return res.json({
      success: true,
      platform: 'ResearchGate',
      signals,
      data: {
        authorName,
        publications:          publications          ?? null,
        citations:             citations             ?? null,
        reads:                 reads                 ?? null,
        followers:             followers             ?? null,
        hIndex:                hIndex                ?? null,
        researchInterestScore: researchInterestScore ?? null,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({
        success: false,
        error: 'ResearchGate request timed out (10s)',
        platform: 'ResearchGate',
        signals: ['ResearchGate URL detected (timeout)'],
        data: {}
      });
    }
    return res.json({
      success: false,
      error: err.message,
      platform: 'ResearchGate',
      signals: ['ResearchGate URL detected'],
      data: {}
    });
  }
}
