/* Derived strategy only. Never writes Player, Round, Club or GI source data. */
(function(root){
  'use strict';
  const number=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const unavailable='UNAVAILABLE / 확인 필요';
  const finite=Number.isFinite;
  function observations(player,rounds){
    const result={};
    for(const r of rounds||[]){
      if(r.playerProfileId!==player.id)continue;
      for(const h of r.holes||[])for(const s of h.shots||[]){
        const start=s.positionSource?.start||s.start?.source;
        const end=s.positionSource?.end||s.end?.source;
        const accuracy=[number(s.start?.accuracy),number(s.end?.accuracy)];
        const d=number(s.distanceM);
        if(start!=='GPS'||end!=='GPS'||accuracy.some(a=>a===null||a>15)||
          s.editHistory?.length||s.editingExisting||s.manual_edit||!finite(d)||d<5||d>400)continue;
        const c=result[s.club]||(result[s.club]={count:0,roundIds:new Set(),distances:[],left:0,right:0,short:0,long:0,approach:0});
        c.count++;c.roundIds.add(r.id);c.distances.push(d);
        if(s.direction==='LEFT')c.left++;if(s.direction==='RIGHT')c.right++;
        if(s.depth==='SHORT')c.short++;if(s.depth==='LONG')c.long++;
        if(s.shotIntent==='GREEN_ATTACK'&&['FAIRWAY','A CUT','FRINGE'].includes(s.startLie))c.approach++;
      }
    }
    return Object.fromEntries(Object.entries(result).map(([k,c])=>[k,{...c,
      roundIds:undefined,roundCount:c.roundIds.size,observedDistanceM:c.distances.reduce((a,b)=>a+b,0)/c.count,
      confidence:c.count>=5&&c.roundIds.size>=3?'REFERENCE':'LOW',basis:'EXISTING_STABLE_CLUB_PROFILE'}]));
  }
  function calculate(input,geo){
    const {course,scorecard,player,tee,rounds=[],officialDistances={}}=input;
    if(!course?.holes||!scorecard?.tees?.[tee])throw new Error('Course와 Tee Candidate를 선택해 주세요.');
    const recent=observations(player,rounds);
    const clubs=(player.clubs||[]).filter(c=>c.name!=='Putter'&&number(c.carry)>0).map(c=>({
      ...c,carry:Number(c.carry),min:number(c.carryMin)??Number(c.carry),max:number(c.carryMax)??Number(c.carry),
      recent:recent[c.name]||{count:0,roundCount:0,observedDistanceM:null,confidence:'LOW',basis:'EXISTING_STABLE_CLUB_PROFILE'}
    }));
    if(clubs.length<2)throw new Error('안정된 Club Profile에서 최소 두 클럽이 필요합니다.');
    const approach=clubs.filter(c=>c.carry>=50&&c.carry<=130);
    const preferred=[...approach].sort((a,b)=>{
      const observedA=a.recent.roundCount>=3&&a.recent.count>=5?a.recent.approach:0;
      const observedB=b.recent.roundCount>=3&&b.recent.count>=5?b.recent.approach:0;
      return observedB-observedA||Math.abs(a.carry-85)-Math.abs(b.carry-85);
    })[0]||clubs[clubs.length-1];
    function nextClub(distance){return finite(distance)?[...clubs].sort((a,b)=>Math.abs(a.carry-distance)-Math.abs(b.carry-distance))[0]:null;}
    function miss(club){return club.name==='DR'?player.missProfile?.driver:['5I','6I'].includes(club.name)?player.missProfile?.longIron:null;}
    const holes=Array.from({length:18},(_,i)=>{
      const no=i+1,h=course.holes[String(no)],sc=scorecard.holes[String(no)];
      if(!h?.t||!h?.g||!sc)return {hole:no,status:unavailable,planA:null,planB:null,sourceGeometry:null,
        officialDistanceM:null,scorecardDistanceM:null,gpsDistanceM:null,distanceSource:'UNAVAILABLE',
        greenRange:{frontM:null,centerM:null,backM:null},geometryTypes:[]};
      const origin={lat:h.t[0],lng:h.t[1]},green={lat:h.g[0],lng:h.g[1]},par=number(sc.par);
      const shapes=geo.shapes(h),model=geo.model(h,par),proj=geo.projector(origin);
      const rawGreen=shapes.find(s=>s.type==='GREEN'&&s.path?.length>=3);
      const greenDistances=rawGreen?.path.map(p=>geo.distance(origin,p))||[];
      const gpsDistanceM=geo.distance(origin,green),scorecardDistanceM=number(sc[tee]);
      const officialDistanceM=number(officialDistances[no]);
      const referenceDistanceM=officialDistanceM??scorecardDistanceM??gpsDistanceM;
      const distanceSource=officialDistanceM!==null?'USER_SUPPLIED_OFFICIAL':scorecardDistanceM!==null?'GI_SCORECARD':'GPS_GEOMETRY';
      const greenRange={frontM:greenDistances.length?Math.min(...greenDistances):null,
        centerM:gpsDistanceM,backM:greenDistances.length?Math.max(...greenDistances):null};
      const features=shapes.filter(s=>['BUNKER','WATER','WATER_PATH'].includes(s.type)&&s.path?.length).map(s=>({
        type:s.type==='WATER_PATH'?'WATER':s.type,line:s.line||s.type==='WATER_PATH',path:s.path,xy:s.path.map(proj.toXY),
        center:s.path.reduce((a,p)=>({lat:a.lat+p.lat/s.path.length,lng:a.lng+p.lng/s.path.length}),{lat:0,lng:0})
      }));
      function risks(start,point){
        const xy=proj.toXY(point);
        const rows=features.map(f=>{const d=geo.shapeDistance(xy,f.xy,f.line);return d?{
          type:f.type,distanceM:d.distanceM,side:geo.side(start,point,f.center)
        }:null;}).filter(Boolean).sort((a,b)=>a.distanceM-b.distanceM);
        return {left:rows.find(r=>r.side==='LEFT')||null,right:rows.find(r=>r.side==='RIGHT')||null,
          bunker:rows.find(r=>r.type==='BUNKER')||null,water:rows.find(r=>r.type==='WATER')||null};
      }
      function landing(start,club,zone){
        function carryProjection(){
          const startXY=proj.toXY(start),endXY=proj.toXY(green);
          const local={x:endXY.x-startXY.x,y:endXY.y-startXY.y},len=Math.hypot(local.x,local.y);
          if(!len)return null;
          // Expected landing from stable carry. Never stretch GPS to match scorecard distance.
          const point=proj.toLatLng({x:startXY.x+local.x/len*club.carry,y:startXY.y+local.y/len*club.carry});
          return {point,widthM:null,carryM:club.carry,distanceM:geo.distance(start,point),projectionErrorM:null,
            basis:par===3?'STABLE_CARRY_TO_GI_GREEN':'STABLE_CARRY_PROJECTION_FAIRWAY_UNAVAILABLE'};
        }
        if(par===3||!model)return carryProjection();
        const xy=model.projector.toXY(start),station=xy.x*model.u.x+xy.y*model.u.y;
        const forward=model.sections.filter(s=>s.stationM>station+10);
        const section=geo.section({...model,sections:forward},start,club.carry,null);
        if(!section||section.errorM>Math.max(15,(club.max-club.min)/2))return zone==='CENTER'?carryProjection():null;
        const offset=zone==='LEFT'?section.widthM/3:zone==='RIGHT'?-section.widthM/3:0;
        const point=model.projector.toLatLng({x:model.u.x*section.stationM+model.v.x*(section.centerC+offset),
          y:model.u.y*section.stationM+model.v.y*(section.centerC+offset)});
        return {point,widthM:section.widthM,carryM:club.carry,distanceM:geo.distance(start,point),projectionErrorM:section.errorM};
      }
      function candidate(start,club,zone){
        const l=landing(start,club,zone);if(!l)return null;
        const risk=risks(start,l.point),remainingM=geo.distance(l.point,green),next=nextClub(remainingM);
        const water= risk.water?Math.max(0,15-risk.water.distanceM)/15*80:0;
        const bunker=risk.bunker?Math.max(0,10-risk.bunker.distanceM)/10*25:0;
        const narrow=finite(l.widthM)?Math.max(0,25-l.widthM):par===3?0:25;
        const side=miss(club),sideRisk=side==='LEFT'?risk.left:side==='RIGHT'?risk.right:null;
        const missCost=sideRisk?Math.max(0,20-sideRisk.distanceM):0;
        const safetyCost=water+bunker+narrow+missCost;
        const rangeGap=par===3?Math.max(club.min-referenceDistanceM,referenceDistanceM-club.max,0):0;
        const depthGap=par===3&&finite(greenRange.frontM)?Math.max(greenRange.frontM-club.max,club.min-greenRange.backM,0):0;
        const nextFit=next?Math.abs(next.carry-remainingM):0;
        return {club:club.name,target:zone,landing:l,risk,remainingM,nextClub:next?.name||null,
          safetyCost,score:safetyCost+(par===3?rangeGap+depthGap*.25:remainingM/12+nextFit/5),
          avoidMiss:sideRisk&&sideRisk.distanceM<20?side:risk.left&&risk.left.distanceM<15?'LEFT':risk.right&&risk.right.distanceM<15?'RIGHT':side||'UNAVAILABLE',
          recent:club.recent,clubRange:{minM:club.min,maxM:club.max},second:null};
      }
      const teeClubs=par===3?clubs:clubs.filter(c=>c.carry>=Math.max(...clubs.map(x=>x.carry))*.65);
      const candidates=[];
      for(const club of teeClubs)for(const zone of par===3?['CENTER']:['LEFT','CENTER','RIGHT']){
        const plan=candidate(origin,club,zone);if(!plan)continue;
        if(par===5){
          const seconds=[];
          for(const secondClub of clubs)for(const secondZone of ['LEFT','CENTER','RIGHT']){
            const second=candidate(plan.landing.point,secondClub,secondZone);if(!second)continue;
            const fit=Math.abs(second.remainingM-preferred.carry);
            second.score=second.safetyCost+fit/5;
            seconds.push(second);
          }
          seconds.sort((a,b)=>a.score-b.score);
          plan.second=seconds[0]||null;
          plan.preferredThird={club:preferred.name,distanceM:preferred.carry,
            basis:preferred.recent.roundCount>=3&&preferred.recent.count>=5?'STABLE_PROFILE_WITH_RECENT_REFERENCE':'EXISTING_STABLE_CLUB_PROFILE'};
          plan.score=plan.second?plan.safetyCost*.5+plan.second.score:Infinity;
        }
        candidates.push(plan);
      }
      candidates.sort((a,b)=>a.score-b.score||a.remainingM-b.remainingM);
      const planA=candidates[0]||null;
      const planB=planA?(candidates.find(p=>p.club!==planA.club)||candidates.find(p=>p.target!==planA.target))||null:null;
      for(const p of [planA,planB])if(p){
        const uncertain=Math.abs(referenceDistanceM-gpsDistanceM)>15||!rawGreen||!finite(p.landing.widthM)&&par!==3||par===5&&!p.second;
        p.mode=uncertain||p.safetyCost>=25?'CAUTION':p.avoidMiss==='LEFT'&&['5I','6I'].includes(p.club)?'SWING':
          p.safetyCost<=5&&(par===3&&p.remainingM<=25||par!==3&&p.remainingM<=100)?'ATTACK':'KEEP';
        p.confidence=p.recent.confidence==='LOW'||uncertain?'LOW':'REFERENCE';
        p.instruction=p.club+' · '+p.target+' 공략'+(p.avoidMiss!=='UNAVAILABLE'?' · '+p.avoidMiss+' 미스 주의':' · 위험 정보 확인')+
          (par===5&&p.second?' → '+p.second.club+' 레이업 → '+Math.round(p.second.remainingM)+'m '+p.second.nextClub:'');
        p.hazardClearanceM=Math.min(...[p.risk.bunker?.distanceM,p.risk.water?.distanceM].filter(finite));
        if(!finite(p.hazardClearanceM))p.hazardClearanceM=null;
      }
      return {hole:no,holeId:h.holeId??h.i??null,par,status:planA&&planB?'DERIVED':unavailable,
        officialDistanceM,scorecardDistanceM,gpsDistanceM,referenceDistanceM,distanceSource,greenRange,
        sourceGeometry:h,geometryTypes:[...new Set(shapes.map(s=>s.type))],planA,planB,
        comparison:planA&&planB?{safetyGain:planB.safetyCost-planA.safetyCost,remainingCostM:planA.remainingM-planB.remainingM}:null};
    });
    return {version:'JGI_TOURNAMENT_STRATEGY_V1',courseId:course.courseId,courseVersion:course.version,
      playerId:player.id,playerName:player.name,handicap:player.handicap,tee,teeStatus:'TOURNAMENT_TEE_CANDIDATE',
      basis:'DETERMINISTIC_RULE_INDEX_NOT_PROBABILITY_OR_EXPECTED_SG',holes,recent};
  }
  const api={calculate,observations,unavailable};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JGI_TOURNAMENT_STRATEGY=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
