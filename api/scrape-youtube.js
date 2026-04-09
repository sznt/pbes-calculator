/**
 * /api/scrape-youtube — YouTube Data API v3
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  const YTKEY = process.env.YOUTUBE_API_KEY;
  if (!YTKEY) return res.json({success:false,error:'YOUTUBE_API_KEY not configured',platform:'YouTube',signals:['YouTube URL detected (no API key)'],data:{}});
  try {
    const clean = url.trim().replace(/\/$/,'');
    let channelId = null;
    const idMatch = clean.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
    if (idMatch) channelId = idMatch[1];
    if (!channelId) {
      const hMatch = clean.match(/youtube\.com\/@([\w.-]+)/i);
      if (hMatch) { const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${hMatch[1]}&key=${YTKEY}`); const d = await r.json(); channelId = d.items?.[0]?.id; }
    }
    if (!channelId) return res.json({success:false,error:'Could not resolve channel',platform:'YouTube',signals:[],data:{}});
    const sRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YTKEY}`);
    const sData = await sRes.json();
    const ch = sData.items?.[0];
    if (!ch) return res.json({success:false,error:'Channel not found',platform:'YouTube',signals:[],data:{}});
    const subs = ch.statistics.hiddenSubscriberCount ? null : parseInt(ch.statistics.subscriberCount||'0');
    const videos = parseInt(ch.statistics.videoCount||'0');
    const views = parseInt(ch.statistics.viewCount||'0');
    const signals = [ch.snippet.title && `YouTube: ${ch.snippet.title}`,subs && `${subs.toLocaleString()} subscribers`,videos && `${videos} videos`,views && `${views.toLocaleString()} total views`].filter(Boolean);
    return res.json({success: true,platform:'YouTube',signals,data:{channelId,channelTitle:ch.snippet.title,subscribers:subs,videoCount:videos,totalViews:views}});
  } catch(err) { return res.json({success:false,error:err.message,platform:'YouTube',signals:[],data:{}}); }
}
