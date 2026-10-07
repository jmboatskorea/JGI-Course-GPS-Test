const w=require('../../lib/whoop.cjs');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const score=r=>r?.score_state==='SCORED'?r.score:null;
module.exports=async(req,res)=>{
  if(req.method!=='GET')return w.json(res,405,{status:'method_not_allowed'});
  const cfg=w.config();if(!cfg)return w.json(res,503,{status:'credentials pending',connected:false});
  try{
    const s=await w.session(req,res,cfg);
    if(!s)return w.json(res,200,{status:'disconnected',connected:false});
    // WHOOP returns cycles in descending order. Tie recovery and sleep to this cycle,
    // rather than mixing the newest independently fetched records.
    const cycles=await w.get('/cycle?limit=1',s);
    const cycle=cycles.records?.[0];
    if(!cycle)return w.json(res,200,{status:'no_today_data',connected:true,snapshot:null});
    const offset=cycle.timezone_offset||'+00:00';
    const match=/^([+-])(\d{2}):(\d{2})$/.exec(offset);
    const minutes=match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3])):0;
    const localDay=timestamp=>new Date(new Date(timestamp).getTime()+minutes*60000).toISOString().slice(0,10);
    if(localDay(cycle.start)!==localDay(Date.now()))return w.json(res,200,{status:'no_today_data',connected:true,snapshot:null});
    const [recovery,sleep]=await Promise.all([w.get(`/cycle/${cycle.id}/recovery`,s,true),w.get(`/cycle/${cycle.id}/sleep`,s,true)]);
    const r=score(recovery),sl=score(sleep),c=score(cycle);
    const snapshot={source:'WHOOP',capturedAt:new Date().toISOString(),cycleStart:cycle.start,timezoneOffset:offset,recovery:number(r?.recovery_score),sleep:number(sl?.sleep_performance_percentage),hrv:number(r?.hrv_rmssd_milli),restingHR:number(r?.resting_heart_rate),dayStrain:number(c?.strain)};
    return w.json(res,200,{status:'connected',connected:true,snapshot});
  }catch(e){return w.json(res,502,{status:e.message==='reconnect_required'?'reconnect_required':'whoop_unavailable',connected:false});}
};
