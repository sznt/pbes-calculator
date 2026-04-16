/**
 * /api/scrape-github — GitHub public API integration
 *
 * GitHub REST API v3 is completely FREE with no auth for public data.
 * Rate limit: 60 requests/hour unauthenticated (generous for our use case).
 * Documentation: https://docs.github.com/en/rest
 *
 * Extracts: followers, public repos, stars (total across repos), bio, company
 *
 * Accepts either:
 *   - Full GitHub URL: https://github.com/username
 *   - Just the username: username
 *
 * Usage: GET /api/scrape-github?url=https://github.com/username
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

  // Extract GitHub username from URL or treat as bare username
  let username = url
    .replace(/^https?:\/\/(www\.)?github\.com\/?/i, '')
    .replace(/\/.*$/, '')  // remove any trailing path
    .trim();

  if (!username || username.includes('.')) {
    return res.status(400).json({
      success: false,
      error: 'Could not extract GitHub username from URL',
      platform: 'GitHub'
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PersonalBrandCalculator/1.0',
    };

    // Add auth token if available (optional — raises rate limit to 5000/hr)
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // Fetch user profile and repos in parallel
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { signal: controller.signal, headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { signal: controller.signal, headers }),
    ]);
    clearTimeout(timeout);

    if (userRes.status === 404) {
      return res.json({
        success: false,
        error: `GitHub user "${username}" not found`,
        platform: 'GitHub',
        signals: ['GitHub username not found'],
        data: {}
      });
    }

    if (userRes.status === 403) {
      const rateLimitReset = userRes.headers.get('x-ratelimit-reset');
      const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'soon';
      return res.json({
        success: false,
        error: `GitHub API rate limit exceeded. Resets at ${resetTime}`,
        platform: 'GitHub',
        signals: ['GitHub URL detected (rate limited)'],
        data: {}
      });
    }

    if (!userRes.ok) {
      return res.json({
        success: false,
        error: `GitHub API returned status ${userRes.status}`,
        platform: 'GitHub',
        signals: ['GitHub API error'],
        data: {}
      });
    }

    const user  = await userRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];

    // ── Profile data ──────────────────────────────────────────────────────
    const name         = user.name         || user.login;
    const bio          = user.bio          || null;
    const company      = user.company      ? user.company.replace(/^@/, '') : null;
    const location     = user.location     || null;
    const blog         = user.blog         || null;
    const followers    = user.followers    ?? null;
    const following    = user.following    ?? null;
    const publicRepos  = user.public_repos ?? null;
    const accountAge   = user.created_at   ? new Date().getFullYear() - new Date(user.created_at).getFullYear() : null;

    // ── Repository stats ──────────────────────────────────────────────────
    const repoArray = Array.isArray(repos) ? repos : [];
    const totalStars    = repoArray.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const totalForks    = repoArray.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const topLanguages  = [...new Set(repoArray.map(r => r.language).filter(Boolean))].slice(0, 5);

    // Find most starred repos
    const topRepos = repoArray
      .filter(r => !r.fork && r.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 3)
      .map(r => ({ name: r.name, stars: r.stargazers_count, description: r.description }));

    // Hireable flag
    const hireable = user.hireable ?? null;

    // ── Signals ───────────────────────────────────────────────────────────
    const signals = [
      name       ? `GitHub: ${name}`                                          : null,
      followers  ? `${followers.toLocaleString()} GitHub followers`           : null,
      totalStars ? `${totalStars.toLocaleString()} total stars across repos`  : null,
      publicRepos? `${publicRepos} public repositories`                       : null,
      topLanguages.length ? `Languages: ${topLanguages.join(', ')}`           : null,
      company    ? `Works at ${company}`                                       : null,
      accountAge ? `GitHub member for ${accountAge} years`                    : null,
    ].filter(Boolean);

    if (signals.length === 0) signals.push('GitHub profile found (no public data)');

    return res.json({
      success: true,
      platform: 'GitHub',
      signals,
      data: {
        username,
        name,
        bio,
        company,
        location,
        blog,
        followers:   followers   ?? null,
        following:   following   ?? null,
        publicRepos: publicRepos ?? null,
        totalStars:  totalStars  ?? null,
        totalForks:  totalForks  ?? null,
        topLanguages,
        topRepos,
        accountAge:  accountAge  ?? null,
        hireable,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({
        success: false,
        error: 'GitHub API request timed out (10s)',
        platform: 'GitHub',
        signals: ['GitHub URL detected (timeout)'],
        data: {}
      });
    }
    return res.json({
      success: false,
      error: err.message,
      platform: 'GitHub',
      signals: ['GitHub URL detected'],
      data: {}
    });
  }
}
