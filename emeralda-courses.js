/* Ordered views of the verified Emeralda nines; raw nine-hole data stays separate. */
(function(){
  'use strict';
  const CLUB='Emeralda Golf Club',nines=['River','Lake','Plantation'],ids=[22976,22977,22978],cache=new Map();
  const known=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const isRound=r=>r?.course===CLUB;
  const isHole=h=>ids.includes(h?.sourceCourseId);
  const pair=(front,back)=>nines.includes(front)&&nines.includes(back)&&front!==back?front+' / '+back:null;
  function compose(front,back){
    const name=pair(front,back);if(!name)return null;
    if(cache.has(name))return cache.get(name);
    const source=window.JGI_EMERALDA_NINES||[],parts=[front,back].map(n=>source.find(e=>e.data.nine===n));
    if(parts.some((e,i)=>!e||e.data.courseId!==ids[nines.indexOf([front,back][i])]||Object.keys(e.data.holes||{}).length!==9))return null;
    const version='GI_EMERALDA_18_V1_'+parts.map(e=>e.data.courseId).join('_')+'_'+String(window.JGI_EMERALDA_SOURCE?.sourceZipSha256||parts[0].data.version).slice(0,16);
    const holes={},cardHoles={},waters=[];
    parts.forEach((entry,half)=>{
      const offset=waters.length;waters.push(...(entry.data.waters||[]));
      for(let local=1;local<=9;local++){
        const hole=half*9+local,h=entry.data.holes[local],s=entry.scorecard.holes[local];
        holes[hole]={...h,sourceCourseId:entry.data.courseId,sourceHoleNumber:local,sourceNine:entry.data.nine};
        if(h.w)holes[hole].w=h.w.map(i=>i+offset);
        cardHoles[hole]={...s,sourceCourseId:entry.data.courseId,sourceHoleNumber:local,sourceNine:entry.data.nine};
      }
    });
    const courseIds=parts.map(e=>e.data.courseId),tees={};
    for(const tee of ['Gold','Black','Blue','White','Red']){
      const distances=Object.values(cardHoles).map(h=>h[tee]);
      tees[tee]={label:tee,rating:null,slope:null,total:distances.every(known)?distances.reduce((a,b)=>a+b,0):null};
    }
    const common={course:CLUB,nine:name,courseId:null,courseIds,version};
    const value={data:{...common,holes,waters,source:'VERIFIED_GI_NINE_COMBINATION'},
      scorecard:{...common,courseName:name,distanceUnit:'m',tees,holes:cardHoles,
        source:'Lake: historical official indexed scorecard; River/Plantation: official values unresolved',
        status:'PARTIAL_HISTORICAL_SCORECARD',handicapStatus:'COMBINED_18_ALLOCATION_UNVERIFIED'}};
    cache.set(name,value);return value;
  }
  function entry(r){
    if(!isRound(r))return null;
    const [front,back,...extra]=String(r.nine||'').split(' / ');
    if(extra.length||pair(front,back)!==r.nine)return null;
    const e=compose(front,back);return e&&(!r.courseVersion||r.courseVersion===e.data.version)?e:null;
  }
  const data=r=>entry(r)?.data||null,scorecard=r=>entry(r)?.scorecard||null;
  const sourceHole=(r,hole)=>data(r)?.holes?.[String(hole)]||null;
  function catalog(){
    return nines.flatMap(front=>nines.filter(back=>front!==back).map(back=>compose(front,back)).filter(Boolean))
      .map(e=>({course:CLUB,nine:e.data.nine,version:e.data.version}));
  }
  function sgMissing(r,h,s,index){
    if(!isRound(r))return null;
    if(!data(r))return 'Emeralda 코스 조합/버전 확인 필요';
    if(![3,4,5].includes(h?.par))return '공식 Par 미확정';
    if(index===0&&String(s?.startLie).toUpperCase()==='TEE'&&!known(h.teeDistanceM))return '선택 Tee 공식 거리 미확정';
    return null;
  }
  const scorecardReady=r=>!isRound(r)||!!r?.holes?.length&&r.holes.every(h=>[3,4,5].includes(h.par));
  const targetReady=r=>!isRound(r)||scorecardReady(r)&&r.holes.every(h=>known(h.strokeIndexLadies));
  function sgValues(r,summary){
    if(!isRound(r))return null;
    const missing={ott:0,app:0,arg:0,putt:0,unknown:0};let records=0;
    for(const h of r.holes||[]){
      (h.shots||[]).forEach((s,i)=>{records++;if(!window.computeShotSG(h,s,i,summary.info,r))missing[window.sgLieKey(s.startLie)?window.sgShotCategory(h,s,i,r):'unknown']++;});
      (h.puttsDetail||[]).forEach((p,i)=>{records++;if(!window.computePuttSG(h,p,i,summary.info))missing.putt++;});
    }
    const values={sgTotal:records&&!summary.counts.missing?summary.total:null};
    for(const [name,key] of [['sgOtt','ott'],['sgApp','app'],['sgArg','arg'],['sgPutt','putt']])values[name]=summary.counts[key]&&!missing[key]&&(key==='putt'||!missing.unknown)?summary.totals[key]:null;
    return values;
  }
  function description(r){
    return !isRound(r)?'':!data(r)?'Emeralda 코스 조합/버전 확인 필요 · 원본 기록 보존':
      r.nine+' · 원본 9홀씩 연결 · Lake 공식 과거 색인 자료 · River/Plantation Par·거리 미확정 · 18홀 Handicap 배정 미확정';
  }
  window.JGIEmeraldaCourses=Object.freeze({CLUB,nines:Object.freeze(nines),ids:Object.freeze(ids),pair,isRound,isHole,catalog,data,scorecard,sourceHole,sgMissing,scorecardReady,targetReady,sgValues,description});
})();
