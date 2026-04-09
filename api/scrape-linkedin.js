/**
 * /api/scrape-linkedin — LinkedIn public profile scraper
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  let profileUrl = url.startsWith('http') ? url : 'https://'+url;
  profileUrl = profileUrl.split('?')[0].replace(/\/$/,'');
  try {
    const ctrl = new AbortController();
    setTimeout(()=>ctrl.abort(),8000);
    const r = await fetch(profileUrl,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0','Accept':'text/html','Accept-Language':'en-US,en;q=0.9'},redirect:'follow'});
    const html = await r.text();
    if (html.includes('authwall')||html.includes('login?session_redirect')) return res.json({success:false,requiresLogin:true,platform:'LinkedIn',signals:['Profile URL valid (login required)'],data:{}});
    const num = s => s ? parseInt(s.replace(/[,.\s]/g,''),10)||null : null;
    const followers = ([html.match(/"followerCount"\s*:\s*(\d+)/),Html.match(/(\d[\d,]+)\s*followers/i)].filter(Boolean)[0]||[])[1];
    const nameMatch = html.match(/class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)/);
    const signals = [nameMatch && `Profile: ${nameMatch[1]?.trim()}`,followers && `${num(followers)} followers`].filter(Boolean);
    if (!signals.length) signals.push('LinkedIn profile detected');
    return res.json({success:true,platform:'LinkedIn',signals,data:{name:nameMatch?[1]?.trim()||null,followers:num(followers)}});
  } catch(err) { return res.json({success:false,error:err.message,platform:'LinkedIn',signals:[],data:{}}); }
}
