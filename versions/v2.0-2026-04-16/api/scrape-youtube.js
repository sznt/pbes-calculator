/**
 * /api/scrape-youtube — YouTube Data API v3 (free, 10,000 units/day)
 *
 * Requires a free Google API key with YouTube Data API v3 enabled.
 * Create one at: https://console.cloud.google.com → APIs & Services → Credentials
 * Enable: https://console.cloud.google.com/apis/library/youtube.googleapis.com
 * Cost: FREE (10,000 units/day; a channel lookup costs ~3 units)
 *
 * Accepts:
 *   - Channel URL:  https://youtube.com/@channelhandle
 *   - Channel URL:  https://youtube.com/channel/UCxxxxxxxxxxxxxxxx
 *   - Channel URL:  https://youtube.com/c/channelname
 *   - Channel URL:  https://youtube.com/user/username
 *
 * Usage: GET /api/scrape-youtube?url=https://youtube.com/@yourhandle
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

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  if (!YT_KEY) {
    // Graceful fallback: HTML scrape without API key (limited but works for subscriber counts)
    return scrapeWithoutKey(url, res);
  }

  try {
    const channelId = await resolveChannelId(url, YT_KEY);
    if (!channelId) {
      return res.json({
        success: false,
        error: 'Could not resolve YouTube channel from this URL. Check it links to a public channel.',
        platform: 'YouTube',
        signals: ['YouTube URL detected (channel not found)'],
        data: {}
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Fetch channel statistics
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${YT_KEY}`,
      { signal: controller.signal, headers: { 'Accept': 'application/json' } }
    );
    clearTimeout(timeout);

    if (!statsRes.ok) {
      const errText = await statsRes.text();
      // Handle quota exceeded
      if (statsRes.status === 403 && errText.includes('quotaExceeded')) {
        return res.json({
          success: false,
          error: 'YouTube API daily quota exceeded (10,000 units/day). Resets at midnight Pacific time.',
          platform: 'YouTube',
          signals: ['YouTube URL detected (quota exceeded today)'],
          data: {}
        });
      }
      return res.json({ success: false, error: `YouTube API error: ${statsRes.status}`, platform: 'YouTube', signals: [], data: {} });
    }

    const statsData = await statsRes.json();
    const channel = statsData.items?.[0];
    if (!channel) {
      return res.json({ success: false, error: 'Channel data not returned', platform: 'YouTube', signals: [], data: {} });
    }

    const snippet    = channel.snippet    || {};
    const statistics = channel.statistics || {};
    const branding   = channel.brandingSettings?.channel || {};

    const channelTitle    = snippet.title       || null;
    const description     = snippet.description || null;
    const country         = snippet.country     || null;
    const publishedAt     = snippet.publishedAt || null;
    const subscribers     = statistics.hiddenSubscriberCount ? null : parseInt(statistics.subscriberCount || '0', 10);
    const videoCount      = parseInt(statistics.videoCount   || '0', 10);
    const totalViews      = parseInt(statistics.viewCount    || '0', 10);
    const keywords        = branding.keywords   || null;

    const accountAge = publishedAt
      ? new Date().getFullYear() - new Date(publishedAt).getFullYear()
      : null;

    const signals = [
      channelTitle ? `YouTube: ${channelTitle}`                                      : null,
      subscribers  ? `${subscribers.toLocaleString()} subscribers`                   : 'Subscriber count is hidden',
      videoCount   ? `${videoCount.toLocaleString()} videos published`               : null,
      totalViews   ? `${totalViews.toLocaleString()} total views`                    : null,
      accountAge   ? `Channel active for ${accountAge} years`                       : null,
      country      ? `Based in ${country}`                                           : null,
    ].filter(Boolean);

    return res.json({
      success: true,
      platform: 'YouTube',
      signals,
      data: {
        channelId,
        channelTitle,
        description: description ? description.slice(0, 300) : null,
        subscribers:  subscribers  ?? null,
        videoCount:   videoCount   ?? null,
        totalViews:   totalViews   ?? null,
        accountAge:   accountAge   ?? null,
        country,
        keywords,
      }
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({ success: false, error: 'YouTube API request timed out', platform: 'YouTube', signals: ['YouTube URL detected (timeout)'], data: {} });
    }
    return res.json({ success: false, error: err.message, platform: 'YouTube', signals: ['YouTube URL detected'], data: {} });
  }
}

// ── Resolve channel ID from various URL formats ───────────────────────────────
async function resolveChannelId(url, apiKey) {
  const clean = url.trim().replace(/\/$/, '');

  // Direct channel ID in URL
  const idMatch = clean.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
  if (idMatch) return idMatch[1];

  // @handle format (YouTube API can search by forHandle)
  const handleMatch = clean.match(/youtube\.com\/@([\w.-]+)/i);
  if (handleMatch) {
    const handle = handleMatch[1];
    const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`);
    const d = await r.json();
    if (d.items?.[0]?.id) return d.items[0].id;
  }

  // /c/customname or /user/username — search by name
  const nameMatch = clean.match(/youtube\.com\/(?:c\/|user\/)([\w.-]+)/i);
  if (nameMatch) {
    const name = nameMatch[1];
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(name)}&maxResults=1&key=${apiKey}`);
    const d = await r.json();
    const channelId = d.items?.[0]?.snippet?.channelId;
    if (channelId) return channelId;
  }

  return null;
}

// ── Fallback: HTML scrape when no API key ─────────────────────────────────────
async function scrapeWithoutKey(url, res) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    clearTimeout(timeout);
    const html = await response.text();

    // YouTube embeds subscriber count in a meta or JSON blob
    const subMatch = html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"\}/) ||
                     html.match(/(\d[\d,.]+[KMB]?)\s*subscribers/i);
    const subscribers = subMatch ? subMatch[1] : null;

    const titleMatch = html.match(/<meta name="title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    const channelTitle = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : null;

    const videoMatch = html.match(/"videoCountText":\{"runs":\[\{"text":"(\d[\d,]*)"/);
    const videoCount = videoMatch ? parseInt(videoMatch[1].replace(/,/g, ''), 10) : null;

    const signals = [
      channelTitle  ? `YouTube: ${channelTitle}`   : null,
      subscribers   ? `${subscribers} subscribers` : null,
      videoCount    ? `${videoCount} videos`       : null,
      !subscribers && !videoCount ? 'YouTube channel detected (add YOUTUBE_API_KEY for full data)' : null,
    ].filter(Boolean);

    return res.json({
      success: !!(channelTitle || subscribers),
      platform: 'YouTube',
      signals,
      note: 'Add YOUTUBE_API_KEY environment variable for complete, reliable data.',
      data: { channelTitle, subscribers, videoCount }
    });
  } catch (err) {
    return res.json({ success: false, error: err.message, platform: 'YouTube', signals: ['YouTube URL detected (no API key configured)'], data: {} });
  }
}
