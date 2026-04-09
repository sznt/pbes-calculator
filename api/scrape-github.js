/** GitHub */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  res.setHeader('Access-Control-Allow-Origin','*');
  const { url } = req.query;
  if (!url) return res.status(400).json({success:false,error:'url required'});
  let username = url.replace(/^https?:\/\/(www\.)?github\.com\/?/i, '').replace(/\/.*$/, '').trim();
  if (!username) return res.status(400).json({success:false,error:'Invalid URL',platform:'GitHub'});
  try {
    const hdrs = {'Accept':'application/vnd.github.v3+json','User-Agent':'PBESCalc/1.0'};
    if (process.env.GITHUB_TOKEN) hdrs['Authorization'] = 'Bearer '+process.env.GITHUB_TOKEN;
    const [uRes,rRes] = await Promise.all([fetch(`https://api.github.com/users/${username}`,{headers:hdrs}),fetch(`https://api.github.com/users/${username}/repos?per_page=100`,{headers:hdrs})]);
    if (uRes.status === 404) return res.json({success:false,error:'User not found',platform:'GitHub',signals:[],data:{}});
    const user = await uRes.json();
    const repos = rRes.ok ? await rRes.json() : [];
    const arr = Array.isArray(repos) ? repos : [];
    const totalStars = arr.reduce((s,r)=>s+(r.stargazers_count||0),0);
    const signals = [user.name&&'GitHub: '+user.name,user.followers&&user.followers+' followers',worksCount&&totalStars+' stars'].filter(Boolean);
    return res.json({success:true,platform:'GitHub',signals,data:{username,name:user.name,followers:user.followers,publicRepos:user.public_repos,totalStars}});
  } catch(e) { return res.json({success:false,error:e.message,platform:'GitHub',signals:[],data:{}}); }
}
