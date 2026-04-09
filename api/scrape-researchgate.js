/** ResearchGate */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  let u = url.startsWith('http') ? url : 'https://www.researchgate.net/profile/'+url;
  try {
    const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(),10000);
    const r = await fetch(u,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/122.0.0.0','Accept':'text/html'},redirect:'follow'});
    const html = await r.text();
    if (r.status===403||r.status===503||html.includes('cf-browser-verification')) return res.json({success:false,blocked:true,platform:'ResearchGate',signals:['ResearchGate blocked'],data:{}});
    const num = s=>s?parseInt(s.replace(/[,.\s]/g,''),10)||null:null;
    const pub = html.match(/(\d[\d,]+)\s*[Pp]ublications?/);
    const cit = html.match(/(\d[\d,]+)\s*[Cc]itations?/);
    const read = html.match(/(\d[\d,]+)\s*[Rr]eads?/);
    const signals = [pub&&`${num(pub[1])} publications`,cit&&`${num(cit[1])} citations`,read&&`${num(read[1])} reads`].filter(Boolean);
    if (!signals.length) signals.push('ResearchGate profile detected');
    return res.json({success:true,platform:'ResearchGate',signals,data:{publications:num(pub?.[1]),citations:num(cit?.[1]),reads:num(read?.[1])}});
  } catch(e) { return res.json({success:false,error:e.message,platform:'ResearchGate',signals:[],data:{}}); }
}
