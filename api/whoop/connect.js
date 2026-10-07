const w=require('../../lib/whoop.cjs');
module.exports=async(req,res)=>{
  w.headers(res);
  if(req.method!=='POST')return w.json(res,405,{status:'method_not_allowed'});
  const cfg=w.config();if(!cfg)return w.json(res,503,{status:'credentials pending'});
  if(!w.sameOrigin(req,cfg))return w.json(res,403,{status:'origin_rejected'});
  // WHOOP requires an eight-character OAuth state. It is sealed and expires in ten minutes.
  const state=w.crypto.randomBytes(6).toString('base64url');
  res.setHeader('Set-Cookie',w.cookie(w.STATE,w.encode({state,until:Date.now()+600000},cfg),600));
  const url=new URL('https://api.prod.whoop.com/oauth/oauth2/auth');
  url.search=new URLSearchParams({client_id:cfg.id,redirect_uri:cfg.redirect,response_type:'code',scope:'read:recovery read:sleep read:cycles offline',state}).toString();
  res.redirect(303,url.toString());
};
