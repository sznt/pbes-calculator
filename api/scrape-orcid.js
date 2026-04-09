/** ORCID API */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  const m = url.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  if (!m) return res.status(400).json({success:false,error:'Invalid ORCID',platform:'ORCID'});
  const id = m[1];
  try {
    const [pRes,wRes] = await Promise.all([
      fetch(`https://pub.orcid.org/v3.0/${id}/person`,{headers:{'Accept':'application/json'}}),
      fetch(`https://pub.orcid.org/v3.0/${id}/works`,{headers:{'Accept':'application/json'}})
    ]);
    if (pRes.status === 404) return res.json({success:false,error:'ORCID not found',platform:'ORCID',signals:[],data:{}});
    const person = await pRes.json();
    const wData = wRes.ok ? await wRes.json() : null;
    const n = person?.name;
    const name = n?.['credit-name']?.value||[n+!['given-names']?.value,n?.['family-name']?.value].filter(Boolean).join(' ')||null;
    const works = wData?.group?.length||0;
    const signals = [name&&'ORCID: '+name,works&&works+' works on ORCID'].filter(Boolean);
    if (!signals.length) signals.push('ORCID profile found');
    return res.json({success: true,platform:'ORCID',signals,data:{orcidId:id,fullName:name,worksCount:works}});
  } catch(e) { return res.json({success:false,error:e.message,platform:'ORCID',signals:[],data:{}}); }
}
