(function(){
  'use strict';
  const engine=window.JGI_TOURNAMENT_STRATEGY;
  const unavailable=engine.unavailable;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const m=v=>Number.isFinite(v)?Math.round(v)+'m':unavailable;
  const risk=r=>r?escape(r.type)+' '+m(r.distanceM):unavailable;
  let strategy=null,holeNo=1,map=null,overlays=[],opened=false,mapTimer=null,priorOverflow='';
  const officialDistances={};
  const courses=sharedCourseSources;
  const geo={shapes:courseShapes,model:buildCourseIntelligenceModel,projector:courseLocalProjector,
    distance:hav,shapeDistance:distanceToShapeXY,side:riskSide,section:projectedLandingSection};
  function rounds(){
    const result=loadCompletedRounds();
    try{const active=JSON.parse(localStorage.getItem(STORAGE)||'null');
      if(active&&!result.some(r=>r.id===active.id))result.push(active);
    }catch{}
    return result;
  }
  function players(){
    const result=[{...PARK_JIEUN_PROFILE,clubs:PARK_JIEUN_PROFILE.clubs.map(c=>({...c}))}];
    // Other real Players can be selected only when an existing saved Club Profile is present.
    for(const r of [...rounds()].sort((a,b)=>(b.startedAt||0)-(a.startedAt||0))){
      if(!r.playerProfileId||result.some(p=>p.id===r.playerProfileId)||!Array.isArray(r.clubProfile)||!r.clubProfile.length)continue;
      result.push({id:r.playerProfileId,name:r.playerName||r.playerProfileId,handicap:r.playerHandicap,
        clubs:r.clubProfile.map(c=>({...c})),missProfile:{...(r.missProfile||{})}});
    }
    return result;
  }
  const panel=document.createElement('section');
  panel.id='tournamentStrategy';panel.hidden=true;panel.setAttribute('aria-label','Personalized Tournament Course Strategy');
  panel.innerHTML=`<header class="ts-head"><div><small>JGI · TOURNAMENT STRATEGY V1</small><h1>18홀 개인 코스 매니지먼트</h1></div><button id="tsClose" type="button">닫기</button></header>
    <div class="ts-settings"><label>Player<select id="tsPlayer"></select></label><label>Course<select id="tsCourse"></select></label>
    <label>Tee<select id="tsTee"></select></label><label>Start Hole<select id="tsStart"></select></label>
    <label>경기일<input id="tsDate" type="date"></label><label>Tee Time<input id="tsTime" type="time"></label></div>
    <p class="ts-note">Tournament Tee Candidate · 색상·후보별 Tee GPS 미확인. 실제 대회 Tee를 확인하세요. GPS Observed Distance는 Carry가 아닙니다.</p>
    <button id="tsGenerate" class="ts-primary" type="button">18홀 Personalized Strategy 생성</button><p id="tsStatus" role="status"></p>
    <div id="tsResults" hidden><nav id="tsHoles" aria-label="Hole 1–18"></nav>
    <div class="ts-hole-head"><h2 id="tsHoleTitle"></h2><label>Official Distance (확인된 값만 입력)<input id="tsOfficial" type="number" min="1" max="1000" placeholder="UNAVAILABLE / m"></label></div>
    <div id="tsDistance" class="ts-note"></div><p class="ts-note">Pin / Green Setup · Slope · Elevation · Wind: UNAVAILABLE / 확인 필요</p>
    <div id="tsMap" aria-label="Google Satellite Player View"></div><p id="tsMapStatus" class="ts-note"></p>
    <div class="ts-legend">TEE ↓ · GREEN ↑ · A 초록 / B 주황 · IP 예상 착지 · 150 / 100 / 50m 참고선</div>
    <div id="tsPlans" class="ts-plans"></div><div id="tsComparison" class="ts-note"></div>
    <details class="ts-basis"><summary>계산 근거와 데이터 제한</summary><p>Stable Club Profile Carry를 유지합니다. Recent GPS Shot은 품질 확인 후 관찰 거리·미스 횟수 Reference로만 표시합니다. LOW Sample은 장기 패턴이나 확률이 아닙니다.</p>
    <p>V1은 확률·예측 SG 대신 공개된 결정 규칙으로 비교합니다: Water 15m, Bunker 10m, Fairway 25m 미만 및 기존 Miss 방향의 근접 위험에 주의 가중치; 남은 거리와 다음 클럽 Carry 차이도 비교합니다. Par 5는 2nd 착지 위험과 Stable Approach 거리 적합도를 비교합니다. 확인되지 않은 Tee 좌표에서는 CAUTION입니다.</p>
    <p>Hazard Clearance는 IP와 GI 경계 사이의 수평 거리입니다. 장애물 높이를 넘기는 Carry Clearance·OB·Tree·Wind 영향은 확인 불가입니다. Geometry가 없는 곳에 Feature를 생성하지 않습니다.</p></details>
    <h2>18-Hole Quick Sheet</h2><div class="ts-table-wrap"><table id="tsQuick"><thead><tr><th>Hole</th><th>Club</th><th>Target</th><th>Landing</th><th>Remaining</th><th>Next</th><th>Avoid</th><th>Mode</th></tr></thead><tbody></tbody></table></div></div>`;
  document.body.appendChild(panel);
  const el=id=>panel.querySelector('#'+id);
  function fillCourses(){
    el('tsCourse').replaceChildren(...courses.map(c=>new Option(c.data.course+' · '+c.data.nine,String(c.data.courseId))));
    el('tsCourse').value='34617';
    el('tsPlayer').replaceChildren(...players().map(p=>new Option(p.name+' · HCP '+(p.handicap??'확인 필요'),p.id)));
    el('tsStart').replaceChildren(...Array.from({length:18},(_,i)=>new Option(String(i+1),String(i+1))));
    fillTees();
  }
  function source(){return courses.find(c=>String(c.data.courseId)===el('tsCourse').value);}
  function fillTees(){
    el('tsTee').replaceChildren(new Option('Tee 선택',''),...Object.entries(source().scorecard.tees).map(([k,t])=>new Option(k+' · '+m(t.total),k)));
    strategy=null;el('tsResults').hidden=true;
  }
  function generate(){
    try{
      const c=source(),p=players().find(p=>p.id===el('tsPlayer').value);
      strategy=engine.calculate({course:c.data,scorecard:c.scorecard,player:p,tee:el('tsTee').value,
        rounds:rounds(),officialDistances:officialDistances[c.data.courseId]||{}},geo);
      el('tsStatus').textContent=strategy.playerName+' · '+strategy.holes.filter(h=>h.planA&&h.planB).length+'/18홀 Plan A/B · Stable Club Profile 기준';
      el('tsResults').hidden=false;
      el('tsHoles').replaceChildren(...strategy.holes.map(h=>{
        const b=document.createElement('button');b.type='button';b.textContent=h.hole;b.dataset.hole=h.hole;b.onclick=()=>{holeNo=h.hole;render();};return b;
      }));
      render();
    }catch(e){el('tsStatus').textContent=e.message;}
  }
  function planHtml(label,p,h){
    if(!p)return '<article><h3>Plan '+label+'</h3><p>'+unavailable+'</p></article>';
    const rows=[['Recommended Club',p.club+' · Stable Carry '+m(p.landing.carryM)],['Target',p.target],
      ['Expected Landing',m(p.landing.distanceM)+' · GPS Geometry 기준'],['Fairway Width',m(p.landing.widthM)],
      ['Left Risk',risk(p.risk.left)],['Right Risk',risk(p.risk.right)],['Nearest Bunker',risk(p.risk.bunker)],
      ['Nearest Water',risk(p.risk.water)],['Hazard Clearance',m(p.hazardClearanceM)],
      ['Remaining',m(p.remainingM)+' · GPS Geometry 기준'],['Next Club',p.nextClub||unavailable],
      ['Avoid Miss',p.avoidMiss==='UNAVAILABLE'?unavailable:p.avoidMiss],['Club Range',m(p.clubRange.minM)+'–'+m(p.clubRange.maxM)],
      ['Recent Observation',p.recent.count?m(p.recent.observedDistanceM)+' · '+p.recent.count+' Shots / '+p.recent.roundCount+' Rounds · Reference':unavailable],
      ['Recent Miss Reference',p.recent.count?'LEFT '+p.recent.left+' / RIGHT '+p.recent.right+' / SHORT '+p.recent.short+' / LONG '+p.recent.long+' (관찰 횟수)':unavailable]];
    const second=h.par===5?'<div class="ts-second"><h4>Par 5 · 2nd → Preferred 3rd</h4>'+(p.second?
      '<p>'+escape(p.second.club)+' · '+escape(p.second.target)+' · 착지 '+m(p.second.landing.distanceM)+' · 폭 '+m(p.second.landing.widthM)+'</p><p>Bunker '+risk(p.second.risk.bunker)+' / Water '+risk(p.second.risk.water)+'</p><p>남김 '+m(p.second.remainingM)+' → '+escape(p.second.nextClub)+'</p>':
      '<p>'+unavailable+'</p>')+'<p>선호 3rd 기준 '+escape(p.preferredThird?.club||unavailable)+' '+m(p.preferredThird?.distanceM)+' · Stable Profile / Reference</p></div>':'';
    return '<article class="ts-plan-'+label+'"><h3>Plan '+label+' · '+escape(p.mode)+'</h3><p class="ts-instruction">'+escape(p.instruction)+'</p><dl>'+rows.map(([k,v])=>'<dt>'+k+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl>'+second+'<p class="ts-note">Confidence '+escape(p.confidence)+' · Basis Existing Stable Club Profile</p></article>';
  }
  function render(){
    if(!strategy)return;
    const h=strategy.holes[holeNo-1];
    el('tsHoles').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-current',Number(b.dataset.hole)===holeNo?'true':'false');});
    el('tsHoleTitle').textContent='Hole '+h.hole+' · Par '+(h.par??'확인 필요');
    el('tsOfficial').value=h.officialDistanceM??'';
    el('tsDistance').textContent='Official '+m(h.officialDistanceM)+' | GI Scorecard '+m(h.scorecardDistanceM)+' | GPS Tee→Center '+m(h.gpsDistanceM)+
      ' | 계산 거리 Source '+h.distanceSource+' | Green Front / Center / Back '+m(h.greenRange?.frontM)+' / '+m(h.greenRange?.centerM)+' / '+m(h.greenRange?.backM)+
      ' | Course ID '+strategy.courseId+' / Hole ID '+(h.holeId??unavailable)+' | GI '+(h.geometryTypes?.join(', ')||unavailable);
    el('tsPlans').innerHTML=planHtml('A',h.planA,h)+planHtml('B',h.planB,h);
    el('tsComparison').textContent=h.comparison?'A/B 비교 · B의 위험 지수 차이 '+h.comparison.safetyGain.toFixed(1)+' · A의 Remaining 차이 '+m(h.comparison.remainingCostM)+' (확률·예측 타수가 아님)':unavailable;
    el('tsQuick').querySelector('tbody').innerHTML=strategy.holes.map(x=>{const p=x.planA;return '<tr data-hole="'+x.hole+'">'+
      [x.hole,p?.club,p?.target,m(p?.landing.distanceM),m(p?.remainingM),p?.nextClub,p?.avoidMiss,p?.mode].map(v=>'<td>'+escape(v??unavailable)+'</td>').join('')+'</tr>';}).join('');
    el('tsQuick').querySelectorAll('tbody tr').forEach(r=>r.onclick=()=>{holeNo=Number(r.dataset.hole);render();el('tsHoleTitle').scrollIntoView({block:'start'});});
    drawMap(h);
  }
  function clearMap(){overlays.forEach(o=>o.setMap(null));overlays=[];}
  function drawMap(h){
    clearTimeout(mapTimer);
    if(!opened)return;
    if(!window.google?.maps){
      el('tsMapStatus').textContent='Google Satellite '+unavailable;
      mapTimer=setTimeout(()=>{if(opened&&strategy)drawMap(strategy.holes[holeNo-1]);},1000);return;
    }
    if(!h.sourceGeometry){el('tsMapStatus').textContent=unavailable;clearMap();return;}
    const g=google.maps,t={lat:h.sourceGeometry.t[0],lng:h.sourceGeometry.t[1]},center={lat:h.sourceGeometry.g[0],lng:h.sourceGeometry.g[1]};
    if(!map)map=new g.Map(el('tsMap'),{center:t,zoom:17,mapTypeId:'satellite',renderingType:g.RenderingType.VECTOR,
      tilt:0,heading:0,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,rotateControl:false,
      headingInteractionEnabled:false,tiltInteractionEnabled:false,gestureHandling:'cooperative'});
    clearMap();
    const bounds=new g.LatLngBounds();bounds.extend(t);bounds.extend(center);
    const heading=bearingDeg(t,center);
    const lock=()=>{map.setHeading(heading);map.setTilt(0);};
    map.fitBounds(bounds,{top:55,bottom:55,left:28,right:28});
    g.event.addListenerOnce(map,'idle',()=>{lock();});
    if(!map.__jgiHeadingLock){map.addListener('heading_changed',()=>{if(strategy){const x=strategy.holes[holeNo-1].sourceGeometry;
      if(x){const expected=bearingDeg({lat:x.t[0],lng:x.t[1]},{lat:x.g[0],lng:x.g[1]});if(Math.abs((map.getHeading()||0)-expected)>.01)map.setHeading(expected);}}});map.__jgiHeadingLock=true;}
    function marker(point,label,color){overlays.push(new g.Marker({map,position:point,label:{text:label,color:'#fff',fontWeight:'bold'},
      icon:{path:g.SymbolPath.CIRCLE,scale:label==='TEE'||label==='GREEN'?15:12,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:1}}));}
    function line(path,color,dashed=false){overlays.push(new g.Polyline({map,path,strokeColor:color,strokeWeight:3,strokeOpacity:dashed ? .5 : .95,clickable:false}));}
    marker(t,'TEE','#132d25');marker(center,'GREEN','#226b3f');
    for(const [p,label,color] of [[h.planA,'A','#18e98a'],[h.planB,'B','#ff9a47']])if(p){
      bounds.extend(p.landing.point);line([t,p.landing.point],color);marker(p.landing.point,label+' IP',color);
      if(p.second){line([p.landing.point,p.second.landing.point],color,true);marker(p.second.landing.point,label+' 2',color);bounds.extend(p.second.landing.point);}
    }
    const projector=courseLocalProjector(center),q=projector.toXY(t),length=Math.hypot(q.x,q.y);
    if(length)for(const distance of [150,100,50])if(distance<length){
      const c={x:q.x/length*distance,y:q.y/length*distance},perp={x:-q.y/length*12,y:q.x/length*12};
      line([projector.toLatLng({x:c.x-perp.x,y:c.y-perp.y}),projector.toLatLng({x:c.x+perp.x,y:c.y+perp.y})],'#fff',true);
      marker(projector.toLatLng(c),distance+'m','#405268');
    }
    courseShapes(h.sourceGeometry).filter(s=>['BUNKER','WATER','WATER_PATH'].includes(s.type)).forEach(s=>{
      const options={map,clickable:false,strokeWeight:1,strokeColor:s.type==='BUNKER'?'#e8c88a':'#58a8ed',strokeOpacity:.8};
      overlays.push(s.line||s.type==='WATER_PATH'?new g.Polyline({...options,path:s.path}):new g.Polygon({...options,paths:s.path,fillColor:options.strokeColor,fillOpacity:.2}));
    });
    el('tsMapStatus').textContent='Google Satellite 로딩 중 · GI 원본 Bunker/Water · Player View TEE ↓ / GREEN ↑';
    g.event.addListenerOnce(map,'tilesloaded',()=>{if(opened&&strategy?.holes[holeNo-1]===h)
      el('tsMapStatus').textContent='Actual Google Satellite · GI 원본 Bunker/Water · Player View TEE ↓ / GREEN ↑';});
  }
  function open(){
    fillCourses();if(!opened)priorOverflow=document.body.style.overflow;
    opened=true;panel.hidden=false;document.body.style.overflow='hidden';
    el('tsPlayer').focus();
  }
  el('tsClose').onclick=()=>{opened=false;panel.hidden=true;document.body.style.overflow=priorOverflow;clearTimeout(mapTimer);clearMap();document.getElementById('tournamentStrategyBtn').focus();};
  el('tsCourse').onchange=fillTees;
  el('tsPlayer').onchange=()=>{strategy=null;el('tsResults').hidden=true;};
  el('tsTee').onchange=()=>{strategy=null;el('tsResults').hidden=true;};
  el('tsStart').onchange=()=>{holeNo=Number(el('tsStart').value);if(strategy)render();};
  el('tsGenerate').onclick=()=>{holeNo=Number(el('tsStart').value);generate();};
  el('tsOfficial').onchange=()=>{
    const id=source().data.courseId,raw=el('tsOfficial').value;
    const distance=Number(raw);
    if(raw&&(!Number.isFinite(distance)||distance<=0||distance>1000)){el('tsStatus').textContent='Official Distance 값을 확인해 주세요.';return;}
    officialDistances[id]||={};
    if(raw)officialDistances[id][holeNo]=distance;else delete officialDistances[id][holeNo];
    generate();
  };
  document.getElementById('tournamentStrategyBtn').onclick=open;
  window.JGI_TOURNAMENT_PREVIEW=Object.freeze({open,players,getStrategy:()=>strategy});
  if(new URLSearchParams(location.search).get('view')==='course-strategy')open();
})();
