const w=require('../../lib/whoop.cjs');
module.exports=async(req,res)=>{
  w.headers(res);
  if(req.method!=='GET')return w.json(res,405,{status:'method_not_allowed'});
  const cfg=w.config();if(!cfg)return w.json(res,503,{status:'credentials pending'});
  const saved=w.decode(req,w.STATE,cfg);
  res.setHeader('Set-Cookie',w.cookie(w.STATE,'',0));
  if(!saved||typeof req.query.state!=='string'||req.query.state!==saved.state)return w.json(res,400,{status:'invalid_oauth_state'});
  if(req.query.error||typeof req.query.code!=='string')return res.redirect(303,'/?whoop=cancelled');
  try {
    const tokens=await w.exchange(cfg,{grant_type:'authorization_code',code:req.query.code,redirect_uri:cfg.redirect});
    w.setSession(res,tokens,cfg);
    const sessionCookie=res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie',[sessionCookie,w.cookie(w.STATE,'',0)]);
    res.redirect(303,'/?whoop=connected');
  }catch{res.redirect(303,'/?whoop=connection_failed');}
};
