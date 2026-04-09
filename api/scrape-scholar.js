/** Google Scholar scraper */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  let u = url.startsWith('http')?url:'https://'+url;
  if (!u.includes('hl=')) u += (u.includes('?')?'&':'?')+'hl=en';
  try {
    const r = await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1)','Accept':'text/html','Accept-Language':'en-US'}});
    const html = await r.text();
    if (html.includes('unusual traffic')||html.includes('captcha')) return res.json({success:false,blocked:true,platform:'Google Scholar',signals:['Scholar blocked'],data:{}});
    const nameMatch = html.match(/id="gsc_prf_in"[^>]*>([^<]+)/);
    const stats = [...html.matchAll(/class="gsc_rsb_std">(\d[\d,]*)</g)].map(m=>parseInt(m[1].replace(/,/g,'')));
    const signals = [nameMatch&&'Scholar: '+nameMatch[1],stats[0]&&stats[0]+' citations',stats[2]&&'h-index: '+stats[2]].filter(Boolean);
    if (!signals.length) signals.push('Scholar profile detected');
    return res.json({success:true,platform:'Google Scholar',signals,data:{authorName:nameMatch?.[1]||null,totalCitations:stats[0]||null,hIndex:stats[2]||null,i10Index:stats[4]||null}});
  } catch(e) { return res.json({success:false,error:e.message,platform:'Google Scholar',signals:[],data:{}}); }
}
