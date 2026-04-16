/**
 * /api/scrape-linkedin — LinkedIn public profile scraper
 *
 * Fetches a LinkedIn public profile page server-side (no CORS issue),
 * extracts JSON-LD structured data + visible signal counts.
 *
 * NOTE: LinkedIn increasingly requires login for full profile data.
 * This endpoint extracts whatever is publicly available.
 * Works best for profiles that are set to "public" in LinkedIn settings.
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
  // Normalise to public profile URL (remove trailing slashes, query params)
  profileUrl = profileUrl.split('?')[0].replace(/\/$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(profileUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
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

    // Detect login wall
    const requiresLogin =
      html.includes('authwall') ||
      html.includes('login?session_redirect') ||
      (html.includes('Sign in') && html.includes('to view') && !html.includes('gsc_prf'));

    if (requiresLogin) {
      return res.json({
        success: false,
        requiresLogin: true,
        platform: 'LinkedIn',
        message: 'This profile requires login to view. Ask the person to set their LinkedIn profile to "Public".',
        signals: ['Profile URL valid (login required for full data)'],
        data: {}
      });
    }

    // ── Parse JSON-LD structured data ────────────────────────────────────────
    const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    let personData = null;
    for (const m of ldMatches) {
      try {
        const obj = JSON.parse(m[1]);
        const items = Array.isArray(obj) ? obj : [obj];
        for (const item of items) {
          if (item['@type'] === 'Person' || item['@type']?.includes?.('Person')) {
            personData = item;
            break;
          }
        }
      } catch (_) {}
    }

    // ── Extract metrics from HTML ────────────────────────────────────────────
    const num = str => str ? parseInt(str.replace(/[,.\s]/g, ''), 10) || null : null;

    // Followers
    const followerPatterns = [
      html.match(/"followerCount"\s*:\s*(\d+)/),
      html.match(/(\d[\d,]+)\s*followers?/i),
      html.match(/data-followers="(\d+)"/),
    ].filter(Boolean);
    const followers = followerPatterns.length ? num(followerPatterns[0][1]) : null;

    // Connections
    const connPatterns = [
      html.match(/"connectionCount"\s*:\s*(\d+)/),
      html.match(/(\d[\d,]+)\s*connections?/i),
      html.match(/data-connections="(\d+)"/),
    ].filter(Boolean);
    const connections = connPatterns.length ? num(connPatterns[0][1]) : null;

    // Endorsements
    const endorsePatterns = [
      html.match(/(\d+)\s*endorsement/i),
      html.match(/"endorsementCount"\s*:\s*(\d+)/),
    ].filter(Boolean);
    const endorsements = endorsePatterns.length ? num(endorsePatterns[0][1]) : null;

    // Recommendations
    const recPatterns = [
      html.match(/(\d+)\s*recommendation/i),
    ].filter(Boolean);
    const recommendations = recPatterns.length ? num(recPatterns[0][1]) : null;

    // Name and headline from JSON-LD or HTML
    const name = personData?.name ||
      (html.match(/class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)/) || [])[1]?.trim() || null;

    const headline = personData?.jobTitle ||
      (html.match(/class="[^"]*top-card-layout__headline[^"]*"[^>]*>([^<]+)/) || [])[1]?.trim() || null;

    // Skills count
    const skillsMatch = html.match(/(\d+)\s*skill/i);
    const skillsCount = skillsMatch ? num(skillsMatch[1]) : null;

    const signals = [
      followers    ? `${followers.toLocaleString()} followers`     : null,
      connections  ? `${connections.toLocaleString()} connections` : null,
      endorsements ? `${endorsements} endorsements`                 : null,
      recommendations ? `${recommendations} recommendations`        : null,
      skillsCount  ? `${skillsCount} skills listed`                : null,
      name         ? `Profile: ${name}`                            : null,
    ].filter(Boolean);

    if (signals.length === 0) {
      signals.push('LinkedIn profile URL detected (public data limited)');
    }

    return res.json({
      success: true,
      platform: 'LinkedIn',
      signals,
      data: {
        name,
        headline,
        followers:       followers       ?? null,
        connections:     connections     ?? null,
        endorsements:    endorsements    ?? null,
        recommendations: recommendations ?? null,
        skillsCount:     skillsCount     ?? null,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({ success: false, error: 'LinkedIn request timed out (8s)', platform: 'LinkedIn', signals: ['Profile URL detected (timeout)'], data: {} });
    }
    return res.json({ success: false, error: err.message, platform: 'LinkedIn', signals: ['Profile URL detected'], data: {} });
  }
}
