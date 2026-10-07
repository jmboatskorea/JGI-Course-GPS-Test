/* JGI Target Score Coach V0.1 — deterministic field-test coach for Park Jieun profile. */
(function(){
  'use strict';

  const VERSION='JGI_TARGET_SCORE_COACH_V0_1';
  const byId=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):null;

  function safeRound(){
    return (typeof round!=='undefined'&&round)?round:null;
  }

  function targetPlan(r=safeRound()){
    if(!r)return null;
    const rows=(r.holes||[]).map((h,i)=>({
      hole:Number(h.hole||i+1),
      par:num(h.par),
      si:num(h.strokeIndexLadies)||99
    })).filter(x=>Number.isFinite(x.par));
    if(!rows.length)return null;

    const parTotal=rows.reduce((a,x)=>a+x.par,0);
    const targetScore=num(r.targetScore)??parTotal;
    const holeTargets={};
    rows.forEach(x=>holeTargets[x.hole]=x.par);

    let delta=Math.round(targetScore-parTotal);
    if(delta>0){
      const hardest=[...rows].sort((a,b)=>a.si-b.si||b.par-a.par||a.hole-b.hole);
      let k=0;
      while(delta>0&&hardest.length){
        const x=hardest[k%hardest.length];
        holeTargets[x.hole]+=1;
        delta--;k++;
      }
    }else if(delta<0){
      const scoring=[...rows].sort((a,b)=>b.par-a.par||b.si-a.si||a.hole-b.hole);
      let k=0,guard=0;
      while(delta<0&&scoring.length&&guard<100){
        const x=scoring[k%scoring.length];
        if(holeTargets[x.hole]>2){holeTargets[x.hole]-=1;delta++}
        k++;guard++;
      }
    }

    return {
      version:VERSION,
      targetScore,
      parTotal,
      basis:'LADIES_STROKE_INDEX',
      holeTargets,
      generatedAt:Date.now()
    };
  }

  function ensurePlan(r=safeRound()){
    if(!r)return null;
    const current=r.targetScorePlan;
    const expected=num(r.targetScore);
    if(current?.version===VERSION&&num(current.targetScore)===expected&&current.holeTargets)return current;
    const plan=targetPlan(r);
    if(plan)r.targetScorePlan=plan;
    return plan;
  }

  function holeTarget(holeNo,r=safeRound()){
    const plan=ensurePlan(r);
    return plan?.holeTargets?.[Number(holeNo)]??null;
  }

  function progress(r=safeRound()){
    const plan=ensurePlan(r);
    if(!r||!plan)return null;
    const completed=(r.holes||[]).filter(h=>h.completed);
    const actual=completed.reduce((sum,h)=>sum+(num(typeof holeScore==='function'?holeScore(h):null)||0),0);
    const planned=completed.reduce((sum,h)=>sum+(num(plan.holeTargets?.[h.hole])||num(h.par)||0),0);
    const delta=actual-planned;
    return {
      completed:completed.length,
      actual,
      planned,
      delta,
      remaining:Math.max(0,18-completed.length),
      targetScore:plan.targetScore
    };
  }

  function progressLabel(delta){
    const d=num(delta)||0;
    if(d===0)return 'ON PLAN';
    return d>0?d+' BEHIND':Math.abs(d)+' AHEAD';
  }

  function holePlanLabel(holeNo,r=safeRound()){
    const h=r?.holes?.[Number(holeNo)-1];
    const t=holeTarget(holeNo,r);
    if(!h||!Number.isFinite(t)||!Number.isFinite(num(h.par)))return 'TARGET —';
    const d=t-Number(h.par);
    return d===0?'PAR':d===1?'BOGEY OK':d<0?'BIRDIE':'+'+d;
  }

  function isLeftMissClub(r,club){
    const c=String(club||'').toUpperCase();
    const miss=r?.missProfile||{};
    if(c==='DR'&&String(miss.driver||'').toUpperCase()==='LEFT')return true;
    if(['5I','6I'].includes(c)&&String(miss.longIron||'').toUpperCase()==='LEFT')return true;
    return false;
  }

  function coachStartLie(){
    const h=typeof hole==='function'?hole():null;
    if(!h)return 'UNKNOWN';
    if((h.shots||[]).length===0)return 'TEE';
    return String(typeof currentLie!=='undefined'?currentLie:'UNKNOWN').toUpperCase();
  }

  function recommendationFor(r,club,start){
    const h=typeof hole==='function'?hole():null;
    const ch=typeof courseHoleData==='function'?courseHoleData():null;
    const master=(typeof masterClubs!=='undefined'?masterClubs:[]).find(c=>c.name===club);
    const carry=num(master?.carry);
    let context=null;
    let centerTarget=null;

    if(ch&&start&&Number.isFinite(carry)&&typeof targetZonePointForShot==='function'&&typeof deriveCourseIntelligence==='function'){
      centerTarget=targetZonePointForShot(ch,start,carry,'CENTER',h?.par);
      context=deriveCourseIntelligence(ch,start,carry,centerTarget,h?.par);
    }

    const leftM=num(context?.courseRisk?.left?.distanceM);
    const rightM=num(context?.courseRisk?.right?.distanceM);
    const widthM=num(context?.landingZoneWidth?.widthM??context?.courseRisk?.narrowness?.landingZoneWidthM);
    const missLeft=isLeftMissClub(r,club);

    let target='CENTER';
    let reason='리스크 균형 · CENTER 기준';

    const bothTight=leftM!==null&&rightM!==null&&leftM<18&&rightM<18;
    if((widthM!==null&&widthM<18)||bothTight){
      target='CENTER';
      reason='Landing Zone이 좁거나 양쪽 위험이 가까움';
    }else if(missLeft&&leftM!==null&&leftM<30&&(rightM===null||rightM>leftM+5)){
      target='RIGHT';
      reason='LEFT miss 성향 + 좌측 위험';
    }else if(leftM!==null&&leftM<16&&(rightM===null||rightM>leftM+5)){
      target='RIGHT';
      reason='좌측 위험 회피';
    }else if(rightM!==null&&rightM<16&&(leftM===null||leftM>rightM+5)){
      target='LEFT';
      reason='우측 위험 회피';
    }else if(missLeft){
      target='CENTER';
      reason='LEFT miss 성향 고려 · CENTER 기준';
    }

    const p=progress(r);
    const thisTarget=holeTarget(r?.currentHole,r);
    const currentPar=num(h?.par);
    const lie=coachStartLie();
    const greenD=(start&&ch?.g&&typeof hav==='function')?hav(start,{lat:ch.g[0],lng:ch.g[1]}):null;
    const closeRisk=[leftM,rightM].filter(Number.isFinite).sort((a,b)=>a-b)[0]??null;
    const difficultLie=['RECOVERY','BUNKER','SAND','ROUGH','B CUT'].includes(lie);

    let mode='NEUTRAL';
    if(difficultLie||(closeRisk!==null&&closeRisk<13)||(widthM!==null&&widthM<18)||(Number.isFinite(thisTarget)&&Number.isFinite(currentPar)&&thisTarget>currentPar)||(p&&p.delta<0)){
      mode='DEFEND';
    }else if(p&&p.delta>0&&Number.isFinite(greenD)&&greenD<=100&&['FAIRWAY','A CUT','FRINGE'].includes(lie)&&(closeRisk===null||closeRisk>=20)){
      mode='ATTACK';
    }

    let action=target+' · 타깃 확정 후 평소 루틴';
    if(mode==='DEFEND')action=target+' · 큰 미스 없이 다음 플레이 위치 확보';
    if(mode==='ATTACK')action=target+' · 좋은 Lie면 스코어 기회 사용';

    return {target,reason,mode,action,leftM,rightM,widthM,greenD,lie};
  }

  function buildShotContext(r,club,start,selectedTarget){
    const rec=recommendationFor(r,club,start);
    const p=progress(r);
    return {
      version:VERSION,
      generatedAt:Date.now(),
      targetScore:num(r?.targetScore),
      holeNumber:Number(r?.currentHole)||null,
      targetHoleScore:holeTarget(r?.currentHole,r),
      planStatusBefore:p?progressLabel(p.delta):'—',
      planDeltaBefore:p?.delta??null,
      club:club||null,
      startLie:rec.lie,
      selectedTarget:selectedTarget||'CENTER',
      recommendedTarget:rec.target,
      mode:rec.mode,
      reason:rec.reason,
      action:rec.action,
      risk:{leftM:rec.leftM,rightM:rec.rightM,widthM:rec.widthM},
      distanceToGreenM:rec.greenD
    };
  }

  function currentPreviewContext(){
    const r=safeRound();if(!r)return null;
    if(r.pending?.targetScoreCoach)return r.pending.targetScoreCoach;
    let club=null;
    try{club=typeof mapFirstSelectedClub==='function'?mapFirstSelectedClub():null}catch{}
    const start=(typeof resolveShotStart==='function'?resolveShotStart():null)||(typeof teeBoxPoint==='function'?teeBoxPoint():null);
    return buildShotContext(r,club,start,(typeof targetZone!=='undefined'?targetZone:'CENTER'));
  }

  function resultCoachText(ctx,result){
    if(!ctx)return '';
    const endLie=String(result?.endLie||'').toUpperCase();
    const direction=String(result?.direction||'').toUpperCase();
    const selected=ctx.selectedTarget||'CENTER';
    const recommended=ctx.recommendedTarget||'CENTER';

    if(endLie==='GREEN'||endLie==='HOLED'){
      return '<strong>그린 도달</strong> · 목표 계획 유지 · 다음은 퍼팅/홀 마무리';
    }
    if(direction==='LEFT'&&isLeftMissClub(safeRound(),ctx.club)){
      return '<span class="warn">LEFT miss 관찰</span> · 다음 위치에서는 CENTER/안전구역 우선';
    }
    if(['RECOVERY','BUNKER','SAND'].includes(endLie)){
      return '<span class="warn">'+endLie+'</span> · 다음 샷은 DEFEND · 안전한 플레이 위치 우선';
    }
    if(selected!==recommended){
      return 'Player '+selected+' / JGI '+recommended+' · 결과 저장 · 다음 위치에서 계획 재계산';
    }
    return '결과 저장 · 다음 위치에서 Target Score Plan 재계산';
  }

  function renderBar(){
    const r=safeRound();
    const host=byId('mapFirstCoachBar');
    if(!r||!host)return;
    const p=progress(r);
    const ctx=currentPreviewContext();
    const holeNo=Number(r.currentHole)||1;
    const holePlan=holePlanLabel(holeNo,r);
    const status=p?progressLabel(p.delta):'—';
    const badge=byId('mapFirstCoachPlan');
    const text=byId('mapFirstCoachText');
    if(badge)badge.textContent='H'+holeNo+' '+holePlan+' · '+status;
    if(!text)return;

    if(r.pending?.result){
      text.innerHTML=resultCoachText(ctx,r.pending.result);
      return;
    }

    const selected=ctx?.selectedTarget||'CENTER';
    const rec=ctx?.recommendedTarget||'CENTER';
    const mode=ctx?.mode||'NEUTRAL';
    const modeLabel=mode==='DEFEND'?'DEFEND':mode==='ATTACK'?'ATTACK':'NEUTRAL';
    const mismatch=selected!==rec?' · 현재 '+selected:'';
    text.innerHTML='<strong>JGI '+rec+'</strong>'+mismatch+' · '+modeLabel+' · '+(ctx?.reason||'Target Score Plan');
  }

  function holeLossPoint(h){
    if(!h)return null;
    const info=typeof sgBenchmarkInfo==='function'?sgBenchmarkInfo(safeRound()):null;
    const rows=[];
    (h.shots||[]).forEach((s,i)=>{
      const sg=typeof computeShotSG==='function'?computeShotSG(h,s,i,info):null;
      if(sg&&Number.isFinite(Number(sg.value)))rows.push({type:'SHOT',index:i+1,label:(s.club||'클럽'),sg:Number(sg.value),coach:s.targetScoreCoach||null});
    });
    (h.puttsDetail||[]).forEach((p,i)=>{
      const sg=typeof computePuttSG==='function'?computePuttSG(h,p,i,info):null;
      if(sg&&Number.isFinite(Number(sg.value)))rows.push({type:'PUTT',index:i+1,label:'Putt',sg:Number(sg.value),coach:null});
    });
    rows.sort((a,b)=>a.sg-b.sg);
    return rows[0]||null;
  }

  function decisionMismatch(h){
    const shots=(h?.shots||[]).filter(s=>s?.targetScoreCoach?.recommendedTarget&&s?.targetScoreCoach?.selectedTarget);
    return shots.find(s=>s.targetScoreCoach.recommendedTarget!==s.targetScoreCoach.selectedTarget)||null;
  }

  function holeSummary(h){
    if(!h)return '홀 데이터 없음';
    const target=holeTarget(h.hole,safeRound());
    const actual=typeof holeScore==='function'?holeScore(h):null;
    const delta=Number.isFinite(actual)&&Number.isFinite(target)?actual-target:null;
    const loss=holeLossPoint(h);
    const mismatch=decisionMismatch(h);
    const parts=[];
    parts.push('Target '+(Number.isFinite(target)?target:'—')+' / Actual '+(Number.isFinite(actual)?actual:'—'));
    if(delta!==null)parts.push(delta===0?'계획 충족':(delta>0?'Plan +'+delta:'Plan '+delta));
    if(loss&&loss.sg<-0.02){
      parts.push('가장 큰 SG 손실: '+(loss.type==='PUTT'?'Putt '+loss.index:'Shot '+loss.index+' '+loss.label)+' '+(loss.sg>0?'+':'')+loss.sg.toFixed(2));
    }
    if(mismatch){
      parts.push('의사결정 비교: '+mismatch.club+' Player '+mismatch.targetScoreCoach.selectedTarget+' / JGI '+mismatch.targetScoreCoach.recommendedTarget);
    }
    return parts.join(' · ');
  }

  function renderOverviewCoach(){
    const r=safeRound(),host=byId('targetScoreCoachOverviewBody');
    if(!r||!host)return;
    const p=progress(r),plan=ensurePlan(r);
    if(!p||!plan){host.innerHTML='Target Score Plan 준비 중';return}
    const status=progressLabel(p.delta);
    const statusClass=p.delta>0?'behind':p.delta<0?'ahead':'';
    const nextHole=(r.holes||[]).find(h=>!h.completed)?.hole||r.currentHole||18;
    const nextTarget=holeTarget(nextHole,r);
    const last=[...(r.holes||[])].filter(h=>h.completed).sort((a,b)=>b.hole-a.hole)[0]||null;
    host.innerHTML=
      '<div class="targetCoachOverviewTop"><div><span class="dataNote">TARGET SCORE</span><strong>'+plan.targetScore+'</strong></div><span class="targetCoachStatus '+statusClass+'">'+status+'</span></div>'+
      '<div class="targetCoachGrid">'+
        '<div class="targetCoachMetric"><span>현재 합계</span><b>'+p.actual+'</b></div>'+
        '<div class="targetCoachMetric"><span>계획 합계</span><b>'+p.planned+'</b></div>'+
        '<div class="targetCoachMetric"><span>다음 홀 목표</span><b>H'+nextHole+' · '+(Number.isFinite(nextTarget)?nextTarget:'—')+'</b></div>'+
      '</div>'+
      '<div class="targetCoachNext"><b>다음 행동</b> · '+(currentPreviewContext()?.action||'CENTER · 타깃 확정 후 평소 루틴')+'</div>'+
      (last?'<div class="dataNote" style="margin-top:8px"><b>최근 홀</b> · '+holeSummary(last)+'</div>':'');
  }

  function appendHoleReview(holeNo){
    const host=byId('holeReviewDetail'),r=safeRound();
    if(!host||!r)return;
    const h=r.holes?.[Number(holeNo)-1];if(!h)return;
    host.querySelectorAll('.targetCoachHoleReview').forEach(x=>x.remove());
    const box=document.createElement('div');
    box.className='targetCoachHoleReview';
    box.innerHTML='<b>JGI TARGET SCORE COACH</b><br>'+holeSummary(h);
    host.appendChild(box);
  }

  function roundLossRows(r=safeRound()){
    if(!r)return [];
    const info=typeof sgBenchmarkInfo==='function'?sgBenchmarkInfo(r):null;
    const rows=[];
    (r.holes||[]).forEach(h=>{
      (h.shots||[]).forEach((s,i)=>{
        const sg=typeof computeShotSG==='function'?computeShotSG(h,s,i,info):null;
        if(!sg||!Number.isFinite(Number(sg.value)))return;
        rows.push({
          kind:'SHOT',hole:h.hole,index:i+1,club:s.club||'—',
          sg:Number(sg.value),
          startLie:String(s.startLie||'—'),
          endLie:String(s.endLie||'—'),
          direction:String(s.direction||'—'),
          selectedTarget:s?.targetScoreCoach?.selectedTarget||s.targetZone||null,
          recommendedTarget:s?.targetScoreCoach?.recommendedTarget||null
        });
      });
      (h.puttsDetail||[]).forEach((p,i)=>{
        const sg=typeof computePuttSG==='function'?computePuttSG(h,p,i,info):null;
        if(!sg||!Number.isFinite(Number(sg.value)))return;
        rows.push({
          kind:'PUTT',hole:h.hole,index:i+1,club:'Putt',
          sg:Number(sg.value),startLie:'GREEN',endLie:p.result||'—',
          direction:null,selectedTarget:null,recommendedTarget:null
        });
      });
    });
    return rows.sort((a,b)=>a.sg-b.sg);
  }

  function reportDecisionRows(r=safeRound()){
    if(!r)return [];
    const info=typeof sgBenchmarkInfo==='function'?sgBenchmarkInfo(r):null;
    const rows=[];
    (r.holes||[]).forEach(h=>(h.shots||[]).forEach((s,i)=>{
      const c=s?.targetScoreCoach;
      if(!c?.recommendedTarget||!c?.selectedTarget||c.recommendedTarget===c.selectedTarget)return;
      const sg=typeof computeShotSG==='function'?computeShotSG(h,s,i,info):null;
      rows.push({
        hole:h.hole,index:i+1,club:s.club||'—',
        selected:c.selectedTarget,recommended:c.recommendedTarget,
        result:String(s.direction||s.endLie||'—'),
        sg:Number.isFinite(Number(sg?.value))?Number(sg.value):null,
        reason:c.reason||''
      });
    }));
    return rows.sort((a,b)=>(a.sg??0)-(b.sg??0));
  }

  function reportPatterns(r=safeRound()){
    const shots=(r?.holes||[]).flatMap(h=>h.shots||[]);
    const drivers=shots.filter(s=>String(s.club||'').toUpperCase()==='DR');
    const driverLeft=drivers.filter(s=>String(s.direction||'').toUpperCase()==='LEFT').length;
    const longIrons=shots.filter(s=>['5I','6I'].includes(String(s.club||'').toUpperCase()));
    const longLeft=longIrons.filter(s=>String(s.direction||'').toUpperCase()==='LEFT').length;
    const mismatch=reportDecisionRows(r).length;
    const penalties=(r?.holes||[]).reduce((a,h)=>a+Number(h.penalties||0),0);
    const threePutts=(r?.holes||[]).filter(h=>(h.puttsDetail||[]).length>=3).length;
    return {drivers:drivers.length,driverLeft,longIrons:longIrons.length,longLeft,mismatch,penalties,threePutts};
  }

  function reportNextActions(r=safeRound()){
    const p=reportPatterns(r),actions=[];
    if(p.driverLeft>0)actions.push('Driver · LEFT miss가 관찰된 홀에서는 CENTER 또는 우측 여유 Target을 먼저 검토');
    if(p.longLeft>0)actions.push('Long Iron · 5I/6I에서 LEFT 결과가 반복되면 Pin보다 Green Center 우선');
    if(p.mismatch>0)actions.push('Target 결정 · Player Target과 JGI Target이 달랐던 상황은 어드레스 전에 한 번 더 확인');
    if(p.penalties>0)actions.push('Penalty · 위험지역 인접 샷에서는 한 단계 보수적인 Target/Club 선택');
    if(p.threePutts>0)actions.push('Putting · 3퍼트 발생 홀의 첫 퍼트 거리와 남은 거리 관리 우선');
    if(!actions.length)actions.push('현재 관찰에서는 큰 반복 패턴이 부족함 · 같은 입력 품질로 다음 라운드 표본 확보');
    return actions.slice(0,3);
  }

  function reportHoleFlow(r=safeRound()){
    const plan=ensurePlan(r);if(!r||!plan)return '';
    const completed=(r.holes||[]).filter(h=>h.completed);
    return completed.map(h=>{
      const target=plan.holeTargets?.[h.hole];
      const actual=typeof holeScore==='function'?holeScore(h):null;
      const d=Number.isFinite(actual)&&Number.isFinite(Number(target))?actual-Number(target):null;
      const cls=d===null?'':d>0?'bad':d<0?'good':'';
      const delta=d===null?'—':d===0?'0':(d>0?'+':'')+d;
      return '<div class="finalHoleCell '+cls+'"><span>H'+h.hole+'</span><b>'+actual+'</b><small>T '+target+' · '+delta+'</small></div>';
    }).join('');
  }

  function reportWhoop(r=safeRound()){
    const w=r?.whoopToday;if(!w)return '<div class="finalReportEmpty">WHOOP snapshot 없음</div>';
    const item=(label,value,unit='')=>'<div class="finalReportMetric"><span>'+label+'</span><b>'+(Number.isFinite(Number(value))?Number(value)+(unit?' '+unit:''):'—')+'</b></div>';
    return '<div class="finalReportMetrics">'+
      item('Recovery',w.recovery,'%')+
      item('Sleep',w.sleep,'%')+
      item('HRV',w.hrv,'ms')+
      item('Resting HR',w.restingHR,'bpm')+
      item('Day Strain',w.dayStrain,'')+
      '</div><div class="dataNote">WHOOP 수치는 당시 상태 참고값이며 Shot 결과의 원인으로 단정하지 않습니다.</div>';
  }

  function renderFinalReport(){
    const r=safeRound(),card=byId('finalRoundReportCard'),host=byId('finalRoundReportBody');
    if(!card||!host)return;
    if(!r?.completedAt){
      card.classList.add('hidden');
      host.innerHTML='';
      return;
    }
    card.classList.remove('hidden');

    const plan=ensurePlan(r);
    const completed=(r.holes||[]).filter(h=>h.completed);
    const actual=completed.reduce((sum,h)=>sum+(num(typeof holeScore==='function'?holeScore(h):null)||0),0);
    const planned=completed.reduce((sum,h)=>sum+(num(plan?.holeTargets?.[h.hole])||num(h.par)||0),0);
    const full=completed.length>=18;
    const targetRef=full?(num(r.targetScore)??plan?.targetScore):planned;
    const targetDelta=Number.isFinite(targetRef)?actual-targetRef:null;
    const targetLabel=targetDelta===null?'—':targetDelta===0?'ON TARGET':targetDelta>0?'+'+targetDelta+' vs Target':targetDelta+' vs Target';

    const sg=typeof sgRoundSummary==='function'?sgRoundSummary():null;
    const sgHtml=sg?'<div class="finalReportMetrics">'+
      '<div class="finalReportMetric"><span>SG Total</span><b>'+formatSg(sg.total)+'</b></div>'+
      '<div class="finalReportMetric"><span>Tee</span><b>'+formatSg(sg.totals.ott)+'</b></div>'+
      '<div class="finalReportMetric"><span>Approach</span><b>'+formatSg(sg.totals.app)+'</b></div>'+
      '<div class="finalReportMetric"><span>Around Green</span><b>'+formatSg(sg.totals.arg)+'</b></div>'+
      '<div class="finalReportMetric"><span>Putting</span><b>'+formatSg(sg.totals.putt)+'</b></div>'+
      '</div><div class="dataNote">SG Benchmark · '+sg.info.label+'</div>':'<div class="finalReportEmpty">SG 계산 대기</div>';

    const losses=roundLossRows(r).slice(0,3);
    const lossHtml=losses.length?losses.map((x,i)=>
      '<div class="finalReportListRow"><b>'+(i+1)+'. H'+x.hole+' '+(x.kind==='PUTT'?'Putt '+x.index:'Shot '+x.index+' · '+x.club)+'</b><span>SG '+(x.sg>0?'+':'')+x.sg.toFixed(2)+(x.kind==='SHOT'?' · '+x.startLie+' → '+x.endLie:'')+'</span></div>'
    ).join(''):'<div class="finalReportEmpty">계산 가능한 SG 손실 샷 없음</div>';

    const decisions=reportDecisionRows(r).slice(0,3);
    const decisionHtml=decisions.length?decisions.map(x=>
      '<div class="finalReportListRow"><b>H'+x.hole+' Shot '+x.index+' · '+x.club+'</b><span>Player '+x.selected+' / JGI '+x.recommended+' · Result '+x.result+(Number.isFinite(x.sg)?' · SG '+(x.sg>0?'+':'')+x.sg.toFixed(2):'')+'</span><small>'+x.reason+'</small></div>'
    ).join(''):'<div class="finalReportEmpty">Player Target과 JGI Target이 달랐던 저장 샷 없음</div>';

    const patt=reportPatterns(r);
    const patternHtml='<div class="finalReportPattern">'+
      '<b>Driver LEFT</b><span>'+patt.driverLeft+'/'+patt.drivers+'</span>'+
      '<b>Long Iron LEFT</b><span>'+patt.longLeft+'/'+patt.longIrons+'</span>'+
      '<b>Target mismatch</b><span>'+patt.mismatch+'</span>'+
      '<b>Penalty / 3-putt</b><span>'+patt.penalties+' / '+patt.threePutts+'</span>'+
      '</div><div class="dataNote">이번 라운드에서 관찰된 결과이며 개인 Baseline이나 원인으로 단정하지 않습니다.</div>';

    const actions=reportNextActions(r);
    const actionHtml=actions.map((x,i)=>'<div class="finalReportAction"><b>'+(i+1)+'</b><span>'+x+'</span></div>').join('');

    host.innerHTML=
      '<div class="finalReportHero">'+
        '<div><span>'+(full?'FINAL ROUND REPORT':'PARTIAL ROUND REPORT')+'</span><h3>'+(r.playerName||'Player')+'</h3><p>'+r.course+' · '+r.nine+' · '+String(r.tee||'—')+' Tee · '+completed.length+'H</p></div>'+
        '<div class="finalReportScore"><span>Target '+(full?(r.targetScore??'—'):planned)+'</span><b>'+actual+'</b><small>'+targetLabel+'</small></div>'+
      '</div>'+
      '<div class="finalReportSection"><h4>TARGET SCORE FLOW</h4><div class="finalHoleGrid">'+reportHoleFlow(r)+'</div></div>'+
      '<div class="finalReportSection"><h4>STROKES GAINED</h4>'+sgHtml+'</div>'+
      '<div class="finalReportSection"><h4>BIGGEST LOSSES</h4>'+lossHtml+'</div>'+
      '<div class="finalReportSection"><h4>KEY DECISIONS</h4>'+decisionHtml+'</div>'+
      '<div class="finalReportSection"><h4>OBSERVED PATTERN</h4>'+patternHtml+'</div>'+
      '<div class="finalReportSection"><h4>WHOOP CONDITION</h4>'+reportWhoop(r)+'</div>'+
      '<div class="finalReportSection finalReportNext"><h4>NEXT ROUND · ACTIONS</h4>'+actionHtml+'</div>';
  }

  function installUi(){
    const cockpit=document.querySelector('.mapFirstCockpit');
    const targetRow=cockpit?.querySelector('.mapFirstTargetRow');
    if(cockpit&&targetRow&&!byId('mapFirstCoachBar')){
      const bar=document.createElement('div');
      bar.id='mapFirstCoachBar';
      bar.className='mapFirstCoachBar';
      bar.innerHTML='<div class="mapFirstCoachBadge"><span>JGI COACH</span><b id="mapFirstCoachPlan">TARGET PLAN</b></div><div id="mapFirstCoachText" class="mapFirstCoachText">Target Score Coach 준비 중</div>';
      targetRow.insertAdjacentElement('afterend',bar);
    }
    const overview=document.querySelector('#overviewScreen .card');
    if(overview&&!byId('targetScoreCoachOverviewBody')){
      const card=document.createElement('div');
      card.className='card targetCoachOverview';
      card.innerHTML='<div class="title">JGI TARGET SCORE COACH</div><div class="sub">목표 스코어 계획과 실제 플레이를 샷 단위로 비교합니다.</div><div id="targetScoreCoachOverviewBody" style="margin-top:10px"></div>';
      overview.insertAdjacentElement('afterend',card);
    }
    const coachCard=byId('targetScoreCoachOverviewBody')?.closest('.targetCoachOverview');
    if(coachCard&&!byId('finalRoundReportCard')){
      const report=document.createElement('div');
      report.id='finalRoundReportCard';
      report.className='card finalRoundReport hidden';
      report.innerHTML='<div class="title">JGI FINAL ROUND REPORT V0.1</div><div class="sub">Target Score · Shot Decision · SG · Pattern · Next Action</div><div id="finalRoundReportBody" style="margin-top:10px"></div>';
      coachCard.insertAdjacentElement('afterend',report);
    }
  }

  function wrap(name,after,before){
    const base=window[name];
    if(typeof base!=='function')return;
    window[name]=function(){
      let pre;
      if(before)pre=before.apply(this,arguments);
      const out=base.apply(this,arguments);
      if(after)after.call(this,out,pre,...arguments);
      return out;
    };
  }

  installUi();

  wrap('startRoundWithCondition',function(){
    const r=safeRound();
    if(r){r.targetScoreCoachVersion=VERSION;r.targetScorePlan=targetPlan(r);if(typeof save==='function')save();renderBar()}
  });

  wrap('beginPending',function(ok){
    const r=safeRound();
    if(ok&&r?.pending){
      r.pending.targetScoreCoach=buildShotContext(r,r.pending.club,r.pending.start,r.pending.targetZone||r.pending.target?.zone||'CENTER');
      if(typeof save==='function')save();
      renderBar();
    }
  });

  wrap('updatePendingClub',function(ok){
    const r=safeRound();
    if(ok&&r?.pending){
      r.pending.targetScoreCoach=buildShotContext(r,r.pending.club,r.pending.start,r.pending.targetZone||r.pending.target?.zone||'CENTER');
      if(typeof save==='function')save();
      renderBar();
    }
  });

  wrap('finalizePending',function(shot,coach){
    if(shot&&coach){
      shot.targetScoreCoach=coach;
      if(typeof save==='function')save();
    }
    renderBar();
  },function(){
    return safeRound()?.pending?.targetScoreCoach?JSON.parse(JSON.stringify(safeRound().pending.targetScoreCoach)):null;
  });

  wrap('restoreFinalizedShotAsPending',function(ok,pre,shot){
    if(ok&&safeRound()?.pending&&shot?.targetScoreCoach){
      safeRound().pending.targetScoreCoach=JSON.parse(JSON.stringify(shot.targetScoreCoach));
      if(typeof save==='function')save();
    }
    renderBar();
  });

  wrap('renderRound',function(){renderBar()});
  wrap('syncMapFirstUI',function(){renderBar()});
  wrap('renderOverview',function(){renderOverviewCoach();renderFinalReport()});
  wrap('renderHoleReview',function(out,pre,holeNo){appendHoleReview(holeNo)});

  const targetSeg=byId('targetZoneSegment');
  if(targetSeg)targetSeg.addEventListener('click',()=>setTimeout(renderBar,0));
  const clubList=byId('allClubList');
  if(clubList)clubList.addEventListener('click',()=>setTimeout(renderBar,0));
  const clubPrev=byId('mapFirstClubPrev'),clubNext=byId('mapFirstClubNext');
  if(clubPrev)clubPrev.addEventListener('click',()=>setTimeout(renderBar,0));
  if(clubNext)clubNext.addEventListener('click',()=>setTimeout(renderBar,0));

  const resultSave=byId('saveShotResultBtn');
  if(resultSave)resultSave.addEventListener('click',()=>setTimeout(renderBar,0));

  const r=safeRound();
  if(r){r.targetScoreCoachVersion=VERSION;ensurePlan(r);if(typeof save==='function')save()}
  renderBar();
})();
