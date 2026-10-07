const w=require('../../lib/whoop.cjs');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return w.json(res,405,{status:'method_not_allowed'});
  const cfg=w.config();
  if(!cfg)return w.json(res,503,{status:'credentials pending'});
  if(!w.sameOrigin(req,cfg))return w.json(res,403,{status:'origin_rejected'});
  let revoked=true;
  try{const s=await w.session(req,res,cfg);if(s){const r=await fetch(w.API+'/user/access',{method:'DELETE',headers:{Authorization:'Bearer '+s.access},signal:AbortSignal.timeout(10000)});revoked=r.ok||r.status===401;}}catch{revoked=false;}
  res.setHeader('Set-Cookie',[w.cookie(w.SESSION,'',0),w.cookie(w.STATE,'',0)]);
  w.json(res,200,{status:'disconnected',revoked,notice:revoked?null:'WHOOP 앱의 Integrations에서도 접근 권한을 해제해 주세요.'});
};
