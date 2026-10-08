/* JGI Target Score Coach V0.1 — deterministic field-test coach for Park Jieun profile. */
(function(){
  'use strict';

  const VERSION='JGI_TARGET_SCORE_COACH_V0_2';
  const COURSE_STRATEGY_VERSION='JGI_COURSE_STRATEGY_V1';
  const byId=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  let agentHistoryMode='HOLE';
  let agentHistoryHole=null;

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

  function targetProgressDisplay(delta){
    const d=Number(delta);
    if(!Number.isFinite(d)||d===0)return '목표대로';
    return '목표보다 '+(d>0?'+':'')+d;
  }

  function targetDirectionDisplay(target){
    return ({LEFT:'좌측',CENTER:'중앙',RIGHT:'우측'})[String(target||'CENTER').toUpperCase()]||'중앙';
  }

  function targetSurfaceDisplay(ctx){
    const r=safeRound();
    const intent=String(r?.pending?.shotIntent||'').toUpperCase();
    if(intent==='RECOVERY')return '탈출 지점';
    if(intent==='GREEN_ATTACK')return '그린';
    if(intent==='LAYUP'||intent==='TEE_POSITION')return '페어웨이';

    const h=r?.holes?.[(Number(r?.currentHole)||1)-1];
    if((h?.shots||[]).length===0)return Number(h?.par)===3?'그린':'페어웨이';

    const master=(typeof masterClubs!=='undefined'?masterClubs:[]).find(c=>c?.name===ctx?.club);
    const carry=num(master?.carry);
    if(Number.isFinite(Number(ctx?.distanceToGreenM))&&Number.isFinite(carry)&&Number(ctx.distanceToGreenM)<=carry+10)return '그린';
    return '페어웨이';
  }

  function recommendationDisplay(ctx,target){
    const surface=targetSurfaceDisplay(ctx);
    if(surface==='탈출 지점')return '추천 공략 · 탈출 우선';
    return '추천 공략 · '+surface+' '+targetDirectionDisplay(target);
  }

  function riskTypeDisplay(side){
    const risk=safeRound()?.pending?.courseContext?.courseRisk?.[side]||null;
    const type=String(risk?.type||'').toUpperCase();
    if(type==='WATER')return (side==='left'?'좌측':'우측')+' 해저드 주의';
    if(type==='BUNKER')return (side==='left'?'좌측':'우측')+' 벙커 주의';
    if(type==='OB')return (side==='left'?'좌측':'우측')+' OB 주의';
    return (side==='left'?'좌측':'우측')+' 위험 주의';
  }

  function reasonDisplay(ctx){
    const reason=String(ctx?.reason||'');
    if(reason.includes('LEFT miss')&&reason.includes('좌측 위험'))return '왼쪽 미스 경향 · '+riskTypeDisplay('left');
    if(reason.includes('LEFT miss'))return '왼쪽 미스 경향 · 중앙 공략 우선';
    if(reason.includes('Landing Zone'))return '랜딩 구역이 좁음 · 양쪽 위험 주의';
    if(reason.includes('좌측 위험'))return riskTypeDisplay('left');
    if(reason.includes('우측 위험'))return riskTypeDisplay('right');
    if(reason.includes('리스크 균형'))return '좌우 위험 균형 · 중앙 공략';
    return reason
      .replaceAll('CENTER','중앙')
      .replaceAll('LEFT','좌측')
      .replaceAll('RIGHT','우측')
      .replaceAll('miss','미스')
      .replaceAll('Landing Zone','랜딩 구역');
  }

  function fairwayWidthBand(widthM){
    const w=num(widthM);
    if(w===null||w<0)return {key:'UNKNOWN',label:'데이터 없음'};
    if(w<=19)return {key:'NARROW',label:'좁음'};
    if(w<=28)return {key:'NORMAL',label:'보통'};
    return {key:'WIDE',label:'넓음'};
  }

  function riskDistanceBand(distanceM){
    const d=num(distanceM);
    if(d===null||d<0)return {key:'UNKNOWN',label:'데이터 없음',urgency:0};
    if(d<=5)return {key:'DANGER_NEAR',label:'위험 가까움',urgency:3};
    if(d<=10)return {key:'CAUTION',label:'주의',urgency:2};
    if(d<=15)return {key:'SPACE',label:'여유 있음',urgency:1};
    return {key:'OUTSIDE_15',label:'15m 초과',urgency:0};
  }

  function riskSeverity(type){
    const t=String(type||'').toUpperCase();
    if(t==='OB')return {key:'HIGH',label:'높음',rank:3};
    if(['WATER','HAZARD','PENALTY_AREA','PENALTY AREA'].includes(t))return {key:'MEDIUM',label:'보통',rank:2};
    if(['BUNKER','SAND'].includes(t))return {key:'LOW',label:'낮음',rank:1};
    return {key:'UNKNOWN',label:'확인 필요',rank:0};
  }

  function riskTypeLabel(type){
    const t=String(type||'').toUpperCase();
    if(t==='OB')return 'OB';
    if(['WATER','HAZARD','PENALTY_AREA','PENALTY AREA'].includes(t))return 'Water/Hazard';
    if(['BUNKER','SAND'].includes(t))return 'Bunker';
    return t||'위험요소';
  }

  function riskMeta(raw){
    const distanceM=num(raw?.distanceM);
    const distance=riskDistanceBand(distanceM);
    const severity=riskSeverity(raw?.type);
    return {
      type:String(raw?.type||'').toUpperCase()||null,
      distanceM,
      distanceKey:distance.key,
      distanceLabel:distance.label,
      urgency:distance.urgency,
      severityKey:severity.key,
      severityLabel:severity.label,
      severityRank:severity.rank,
      active:distanceM!==null&&distanceM>=0&&distanceM<=15
    };
  }

  function compareRiskMeta(a,b){
    const ar=a?.active?1:0,br=b?.active?1:0;
    if(ar!==br)return ar-br;
    if(!ar&&!br)return 0;
    if((a?.urgency||0)!==(b?.urgency||0))return (a?.urgency||0)-(b?.urgency||0);
    if((a?.severityRank||0)!==(b?.severityRank||0))return (a?.severityRank||0)-(b?.severityRank||0);
    const ad=num(a?.distanceM),bd=num(b?.distanceM);
    if(ad!==null&&bd!==null&&ad!==bd)return bd-ad;
    return 0;
  }

  function courseMetrics(context){
    const widthM=num(context?.landingZoneWidth?.widthM??context?.courseRisk?.narrowness?.landingZoneWidthM);
    return {
      widthM,
      width:fairwayWidthBand(widthM),
      left:riskMeta(context?.courseRisk?.left),
      right:riskMeta(context?.courseRisk?.right)
    };
  }

  function worstRisk(metrics){
    if(!metrics)return riskMeta(null);
    return compareRiskMeta(metrics.left,metrics.right)>=0?metrics.left:metrics.right;
  }

  function clubMissDirection(r,club){
    const c=String(club||'').toUpperCase();
    const miss=r?.missProfile||{};
    let value=null;
    if(c==='DR')value=miss.driver;
    else if(['5I','6I'].includes(c))value=miss.longIron;
    const dir=String(value||'').toUpperCase();
    return ['LEFT','RIGHT'].includes(dir)?dir:null;
  }

  function isLeftMissClub(r,club){
    return clubMissDirection(r,club)==='LEFT';
  }

  function contextForZone(ch,start,carry,zone,holePar){
    if(!ch||!start||!Number.isFinite(carry)||typeof targetZonePointForShot!=='function'||typeof deriveCourseIntelligence!=='function')return null;
    const target=targetZonePointForShot(ch,start,carry,zone,holePar);
    return target?deriveCourseIntelligence(ch,start,carry,target,holePar):null;
  }

  function targetSourceValue(r=safeRound()){
    const p=r?.pending;
    if(p?.target?.basis==='MAP_OVERRIDE')return 'MAP_OVERRIDE';
    if(p?.targetSource)return String(p.targetSource);
    try{
      if(typeof targetZoneSource!=='undefined'&&targetZoneSource)return String(targetZoneSource);
    }catch{}
    return 'SYSTEM_DEFAULT';
  }

  function hasMapOverride(r=safeRound()){
    if(r?.pending?.target?.basis==='MAP_OVERRIDE')return true;
    try{
      return typeof targetManualOverride!=='undefined'&&targetManualOverride===true;
    }catch{}
    return false;
  }

  function normalizeTargetZone(value){
    const z=String(value||'CENTER').toUpperCase();
    return ['LEFT','CENTER','RIGHT'].includes(z)?z:'CENTER';
  }

  function coachStartLie(){
    const h=typeof hole==='function'?hole():null;
    if(!h)return 'UNKNOWN';
    if((h.shots||[]).length===0)return 'TEE';
    return String(typeof currentLie!=='undefined'?currentLie:'UNKNOWN').toUpperCase();
  }

  function recommendationFor(r,club,start,selectedTarget='CENTER'){
    const h=typeof hole==='function'?hole():null;
    const ch=typeof courseHoleData==='function'?courseHoleData():null;
    const master=(typeof masterClubs!=='undefined'?masterClubs:[]).find(c=>c.name===club);
    const carry=num(master?.carry);
    const chosenByPlayer=normalizeTargetZone(selectedTarget);
    const manualTarget=hasMapOverride(r);

    let centerContext=null;
    if(ch&&start&&Number.isFinite(carry)){
      centerContext=contextForZone(ch,start,carry,'CENTER',h?.par);
    }

    const baseContext=(manualTarget&&r?.pending?.courseContext)?r.pending.courseContext:centerContext;
    const base=courseMetrics(baseContext);
    const missDirection=clubMissDirection(r,club);
    const targetSource=targetSourceValue(r);

    let target=manualTarget?chosenByPlayer:'CENTER';
    let reason=manualTarget?'Player 지정 Target 우선 · 현재 Target 기준 위험 재확인':'리스크 균형 · CENTER 기준';
    let targetCheck={
      required:false,
      candidate:null,
      outcome:manualTarget?'MANUAL_TARGET_PRIORITY':'NOT_NEEDED',
      candidateRisk:null,
      centerRisk:worstRisk(base)
    };

    const recheckCandidate=(candidate,why)=>{
      const candidateContext=contextForZone(ch,start,carry,candidate,h?.par);
      const candidateMetrics=courseMetrics(candidateContext);
      const centerMetrics=courseMetrics(centerContext);
      const candidateWorst=worstRisk(candidateMetrics);
      const centerWorst=worstRisk(centerMetrics);
      targetCheck={
        required:true,
        candidate,
        outcome:'CANDIDATE_OK',
        candidateRisk:candidateWorst,
        centerRisk:centerWorst
      };
      if(candidateContext&&centerContext&&compareRiskMeta(candidateWorst,centerWorst)>0){
        target='CENTER';
        targetCheck.outcome='CENTER_SAFER';
        reason=why+' · 반대쪽 후보 재계산에서 더 큰 위험 → 중앙 조정';
      }else{
        target=candidate;
        reason=why+' · 반대쪽 후보 위험 재확인 완료';
      }
    };

    if(!manualTarget){
      const left=base.left,right=base.right;
      const missRisk=missDirection==='LEFT'?left:missDirection==='RIGHT'?right:null;

      if(missDirection&&missRisk?.active){
        const candidate=missDirection==='LEFT'?'RIGHT':'LEFT';
        const side=missDirection==='LEFT'?'좌측':'우측';
        recheckCandidate(candidate,side+' 미스 경향 · 같은 쪽 '+riskTypeLabel(missRisk.type)+' '+missRisk.distanceLabel);
      }else if(left.active||right.active){
        const cmp=compareRiskMeta(left,right);
        if(cmp>0){
          recheckCandidate('RIGHT','좌측 '+riskTypeLabel(left.type)+' '+left.distanceLabel+' · 반대쪽 공략 검토');
        }else if(cmp<0){
          recheckCandidate('LEFT','우측 '+riskTypeLabel(right.type)+' '+right.distanceLabel+' · 반대쪽 공략 검토');
        }else if(base.width.key==='NARROW'){
          target='CENTER';
          reason='Landing Zone이 좁음 · 양쪽 위험 주의';
        }else{
          target='CENTER';
          reason='양쪽 위험 균형 · 중앙 공략';
        }
      }else if(base.width.key==='NARROW'){
        target='CENTER';
        reason='Landing Zone이 좁음 · 중앙 공략';
      }else if(missDirection){
        target='CENTER';
        reason=(missDirection==='LEFT'?'왼쪽':'오른쪽')+' 미스 경향 · 15m 이내 같은 쪽 위험 없음';
      }
    }

    const p=progress(r);
    const thisTarget=holeTarget(r?.currentHole,r);
    const currentPar=num(h?.par);
    const lie=coachStartLie();
    const greenD=(start&&ch?.g&&typeof hav==='function')?hav(start,{lat:ch.g[0],lng:ch.g[1]}):null;
    const closeRisk=[base.left.distanceM,base.right.distanceM].filter(Number.isFinite).sort((a,b)=>a-b)[0]??null;
    const dangerNear=[base.left,base.right].some(x=>x.active&&x.urgency===3);
    const cautionOrCloser=[base.left,base.right].some(x=>x.active&&x.urgency>=2);
    const difficultLie=['RECOVERY','BUNKER','SAND','ROUGH','B CUT'].includes(lie);

    let mode='NEUTRAL';
    if(difficultLie||dangerNear||base.width.key==='NARROW'||(Number.isFinite(thisTarget)&&Number.isFinite(currentPar)&&thisTarget>currentPar)||(p&&p.delta<0)){
      mode='DEFEND';
    }else if(p&&p.delta>0&&Number.isFinite(greenD)&&greenD<=100&&['FAIRWAY','A CUT','FRINGE'].includes(lie)&&!cautionOrCloser){
      mode='ATTACK';
    }

    let action=target+' · 타깃 확정 후 평소 루틴';
    if(mode==='DEFEND')action=target+' · 큰 미스 없이 다음 플레이 위치 확보';
    if(mode==='ATTACK')action=target+' · 좋은 Lie면 스코어 기회 사용';

    return {
      target,reason,mode,action,
      leftM:base.left.distanceM,rightM:base.right.distanceM,widthM:base.widthM,
      greenD,lie,carry,missDirection,targetSource,manualTarget,
      metrics:base,targetCheck,
      dogleg:baseContext?.dogleg||baseContext?.courseRisk?.dogleg||null,
      strategyVersion:COURSE_STRATEGY_VERSION,
      closeRisk
    };
  }

  function buildShotContext(r,club,start,selectedTarget){
    const selected=normalizeTargetZone(selectedTarget);
    const rec=recommendationFor(r,club,start,selected);
    const p=progress(r);
    return {
      version:VERSION,
      strategyVersion:rec.strategyVersion,
      generatedAt:Date.now(),
      targetScore:num(r?.targetScore),
      holeNumber:Number(r?.currentHole)||null,
      targetHoleScore:holeTarget(r?.currentHole,r),
      planStatusBefore:p?progressLabel(p.delta):'—',
      planDeltaBefore:p?.delta??null,
      club:club||null,
      clubCarryM:rec.carry,
      startLie:rec.lie,
      selectedTarget:selected,
      recommendedTarget:rec.target,
      targetSource:rec.targetSource,
      manualTarget:rec.manualTarget,
      missDirection:rec.missDirection,
      mode:rec.mode,
      reason:rec.reason,
      action:rec.action,
      risk:{
        leftM:rec.leftM,
        rightM:rec.rightM,
        widthM:rec.widthM,
        left:rec.metrics.left,
        right:rec.metrics.right,
        width:rec.metrics.width
      },
      targetCheck:rec.targetCheck,
      dogleg:rec.dogleg,
      distanceToGreenM:rec.greenD
    };
  }

  function currentPreviewContext(){
    const r=safeRound();if(!r)return null;
    const p=r.pending;
    const awaitingLock=!!p&&!p.result&&!p.editingExisting&&p.startLocked!==true;
    if(p?.targetScoreCoach?.version===VERSION&&!awaitingLock)return p.targetScoreCoach;
    let club=null;
    try{club=p?.club||(typeof mapFirstSelectedClub==='function'?mapFirstSelectedClub():null)}catch{}
    let start=null;
    try{
      if(awaitingLock&&typeof gpsPoint==='function')start=gpsPoint();
      if(!start&&p?.start)start=p.start;
      if(!start&&typeof resolveShotStart==='function')start=resolveShotStart();
      if(!start&&typeof teeBoxPoint==='function')start=teeBoxPoint();
    }catch{}
    return buildShotContext(r,club,start,p?.targetZone||(typeof targetZone!=='undefined'?targetZone:'CENTER'));
  }

  function htmlEscape(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function oneDecimalM(value){
    const n=num(value);
    return n===null?'데이터 없음':n.toFixed(1)+'m';
  }

  function targetSourceDisplay(ctx){
    if(ctx?.manualTarget)return '지도에서 Player가 직접 지정';
    const s=String(ctx?.targetSource||'').toUpperCase();
    if(s==='PLAYER_SELECTED')return 'Player 선택';
    if(s==='JGI_RECOMMENDED')return 'JGI 추천';
    if(s==='SYSTEM_DEFAULT')return 'System 기본 Target';
    return s||'확인 필요';
  }

  function detailRiskLine(sideLabel,risk){
    if(!risk||num(risk.distanceM)===null)return sideLabel+' · 위험 데이터 없음';
    return sideLabel+' · '+riskTypeLabel(risk.type)+' '+oneDecimalM(risk.distanceM)+' · '+(risk.distanceLabel||riskDistanceBand(risk.distanceM).label)+' · 위험도 '+(risk.severityLabel||riskSeverity(risk.type).label);
  }

  function targetCheckDisplay(ctx){
    const check=ctx?.targetCheck;
    if(ctx?.manualTarget)return 'Player 수동 Target 우선 · 자동 반대 Target 비교 안 함';
    if(!check?.required)return '반대 Target 재검증 · 필요 없음';
    const candidate=targetDirectionDisplay(check.candidate);
    if(check.outcome==='CENTER_SAFER')return candidate+' 후보 재계산 · 후보 쪽 위험이 더 커 중앙으로 조정';
    return candidate+' 후보 재계산 · 더 큰 위험 없음, 후보 유지';
  }

  function doglegDisplay(dogleg){
    if(!dogleg?.applicable)return '해당 없음 또는 데이터 없음';
    const dir=dogleg.direction==='LEFT'?'좌':dogleg.direction==='RIGHT'?'우':String(dogleg.direction||'');
    const angle=num(dogleg.angleDeg);
    const turn=num(dogleg.distanceToTurnM);
    return dir+' 도그레그'+(angle!==null?' · '+angle.toFixed(1)+'°':'')+(turn!==null?' · 코너 약 '+turn.toFixed(0)+'m':'');
  }

  function strategyMeta(mode){
    const m=String(mode||'NEUTRAL').toUpperCase();
    if(m==='ATTACK')return {key:'attack',label:'공격'};
    if(m==='DEFEND')return {key:'defend',label:'수비'};
    return {key:'neutral',label:'기본'};
  }

  function strategyReasonDisplay(ctx){
    if(!ctx)return '현재 전략 판단 데이터가 없습니다.';
    const mode=String(ctx.mode||'NEUTRAL').toUpperCase();
    const parts=[];
    const delta=num(ctx.planDeltaBefore);
    const widthKey=ctx?.risk?.width?.key||fairwayWidthBand(ctx?.risk?.widthM).key;
    const risks=[ctx?.risk?.left,ctx?.risk?.right].filter(Boolean);
    const dangerNear=risks.some(r=>r?.active&&Number(r?.urgency)>=3);
    const cautionOrCloser=risks.some(r=>r?.active&&Number(r?.urgency)>=2);
    const lie=String(ctx.startLie||'').toUpperCase();
    const difficult=['RECOVERY','BUNKER','SAND','ROUGH','B CUT'].includes(lie);
    const goodLie=['FAIRWAY','A CUT','FRINGE'].includes(lie);
    const greenD=num(ctx.distanceToGreenM);

    if(delta!==null&&delta>0)parts.push('목표보다 +'+delta+' 뒤처짐');
    if(delta!==null&&delta<0)parts.push('목표보다 '+delta+' 앞섬');

    if(mode==='ATTACK'){
      if(goodLie)parts.push('좋은 라이');
      if(greenD!==null&&greenD<=100)parts.push('그린까지 '+Math.round(greenD)+'m');
      if(!cautionOrCloser)parts.push('가까운 큰 위험 없음');
      return parts.length?parts.join(' · '):'현재 스코어 흐름과 샷 조건이 공격 기회에 적합';
    }

    if(mode==='DEFEND'){
      if(widthKey==='NARROW')parts.push('랜딩 구역 좁음');
      if(dangerNear)parts.push('위험요소 5m 이내');
      if(difficult)parts.push('어려운 라이');
      return parts.length?parts.join(' · '):'현재 홀 목표와 코스 위험을 고려해 안전 우선';
    }

    if(widthKey==='NORMAL')parts.push('랜딩 구역 보통');
    if(widthKey==='WIDE')parts.push('랜딩 구역 넓음');
    if(!cautionOrCloser)parts.push('가까운 큰 위험 없음');
    return parts.length?parts.join(' · '):'공격·수비 어느 쪽으로도 강하게 기울지 않는 기본 상황';
  }

  function strategyActionDisplay(ctx){
    const mode=String(ctx?.mode||'NEUTRAL').toUpperCase();
    const target=targetDirectionDisplay(ctx?.recommendedTarget);
    if(mode==='ATTACK')return target+' 공략 · 좋은 조건에서는 스코어 기회를 사용';
    if(mode==='DEFEND')return target+' 공략 · 큰 미스 없이 다음 플레이 위치 확보';
    return target+' 공략 · 타깃을 정하고 평소 루틴대로 실행';
  }

  function coachDetailHtml(ctx){
    if(!ctx)return '<div class="coachDetailEmpty">현재 판단 데이터가 없습니다.</div>';
    const risk=ctx.risk||{};
    const widthM=num(risk.widthM);
    const widthLabel=risk.width?.label||fairwayWidthBand(widthM).label;
    const miss=ctx.missDirection?targetDirectionDisplay(ctx.missDirection)+' 미스 경향':'등록된 미스 방향 데이터 없음';
    const carry=num(ctx.clubCarryM);
    const strategy=strategyMeta(ctx.mode);
    const rows=[
      ['랜딩 구역',widthM===null?'폭 데이터 없음':widthM.toFixed(1)+'m · '+widthLabel],
      ['좌측 위험',detailRiskLine('좌측',risk.left)],
      ['우측 위험',detailRiskLine('우측',risk.right)],
      ['플레이어 패턴',miss],
      ['클럽 / 타깃',(ctx.club||'클럽 데이터 없음')+' · 캐리 '+(carry===null?'데이터 없음':carry.toFixed(0)+'m')+' · '+targetSourceDisplay(ctx)],
      ['반대 타깃 확인',targetCheckDisplay(ctx)],
      ['도그레그',doglegDisplay(ctx.dogleg)]
    ];
    return '<div class="coachStrategyCard '+strategy.key+'">'+
      '<span>현재 전략</span>'+
      '<strong>'+htmlEscape(strategy.label)+'</strong>'+
      '<p>'+htmlEscape(strategyReasonDisplay(ctx))+'</p>'+
      '<div class="coachStrategyAction"><b>지금 행동</b><em>'+htmlEscape(strategyActionDisplay(ctx))+'</em></div>'+
      '</div>'+
      '<div class="coachModalHero">'+
      '<span>JGI 추천 공략</span>'+
      '<strong>'+htmlEscape(recommendationDisplay(ctx,ctx.recommendedTarget))+'</strong>'+
      '<p>'+htmlEscape(ctx.reason||'현재 상황 기준 추천')+'</p>'+
      '</div>'+
      '<div class="coachDetailGrid">'+rows.map(([k,v])=>'<div class="coachDetailRow"><span>'+htmlEscape(k)+'</span><b>'+htmlEscape(v)+'</b></div>').join('')+'</div>'+
      '<div class="coachDetailVersion">'+htmlEscape(ctx.strategyVersion||COURSE_STRATEGY_VERSION)+'</div>';
  }

  function coachWhyHint(){
    return '<span class="coachWhyHint">왜? 자세히 보기 ›</span>';
  }

  function renderCoachModal(ctx=currentPreviewContext()){
    const modal=byId('jgiCoachModal');
    if(!modal||modal.hidden)return;
    const body=byId('jgiCoachModalBody');
    const meta=byId('jgiCoachModalMeta');
    if(body)body.innerHTML=coachDetailHtml(ctx);
    const r=safeRound();
    const holeNo=Number(r?.currentHole)||1;
    const p=progress(r);
    if(meta)meta.textContent=holeNo+'번 홀 · '+(p?targetProgressDisplay(p.delta):'목표 기준');
  }

  function openCoachModal(){
    const modal=byId('jgiCoachModal');
    if(!modal)return;
    modal.hidden=false;
    document.body.classList.add('jgiCoachModalOpen');
    renderCoachModal();
    const close=byId('jgiCoachModalClose');
    setTimeout(()=>close?.focus(),0);
  }

  function closeCoachModal(){
    const modal=byId('jgiCoachModal');
    if(!modal)return;
    modal.hidden=true;
    document.body.classList.remove('jgiCoachModalOpen');
    byId('mapFirstCoachBar')?.focus();
  }

  function resultCoachText(ctx,result){
    if(!ctx)return '';
    const endLie=String(result?.endLie||'').toUpperCase();
    const direction=String(result?.direction||'').toUpperCase();
    const selected=ctx.selectedTarget||'CENTER';
    const recommended=ctx.recommendedTarget||'CENTER';

    if(endLie==='GREEN'||endLie==='HOLED'){
      return '<strong>그린 도달</strong><span class="coachReason">다음은 퍼팅 또는 홀 마무리</span>';
    }
    if(direction==='LEFT'&&isLeftMissClub(safeRound(),ctx.club)){
      return '<strong>왼쪽 미스 확인</strong><span class="coachReason">다음 위치에서는 중앙 또는 안전 구역 우선</span>';
    }
    if(['RECOVERY','BUNKER','SAND'].includes(endLie)){
      const lieText=endLie==='BUNKER'||endLie==='SAND'?'벙커':'트러블';
      return '<strong>'+lieText+'에서 다음 샷</strong><span class="coachReason">안전 공략 · 다음 플레이 위치 확보</span>';
    }
    if(selected!==recommended){
      return '<strong>'+recommendationDisplay(ctx,recommended)+'</strong><span class="coachReason">현재 선택 · '+targetDirectionDisplay(selected)+' · 다음 위치에서 다시 계산</span>';
    }
    return '<strong>결과 저장 완료</strong><span class="coachReason">다음 위치에서 목표 스코어 기준으로 다시 계산</span>';
  }

  function renderBar(){
    const r=safeRound();
    const host=byId('mapFirstCoachBar');
    if(!r||!host)return;
    const p=progress(r);
    const ctx=currentPreviewContext();
    const holeNo=Number(r.currentHole)||1;
    const badge=byId('mapFirstCoachPlan');
    const text=byId('mapFirstCoachText');
    if(badge){
      badge.textContent=holeNo+'번 홀 · '+(p?targetProgressDisplay(p.delta):'목표 기준');
      badge.classList.toggle('coachPlanNegative',Boolean(p&&Number(p.delta)<0));
    }
    renderCoachModal(ctx);
    if(!text)return;

    const strategy=strategyMeta(ctx?.mode);
    const strategyBadge='<span class="coachStrategyBadge '+strategy.key+'">'+strategy.label+'</span>';

    if(r.pending?.result){
      text.innerHTML=strategyBadge+resultCoachText(ctx,r.pending.result)+coachWhyHint();
      return;
    }

    const selected=ctx?.selectedTarget||'CENTER';
    const rec=ctx?.recommendedTarget||'CENTER';
    const mismatch=selected!==rec
      ? '현재 선택 · '+targetSurfaceDisplay(ctx)+' '+targetDirectionDisplay(selected)+' · '
      : '';
    text.innerHTML=strategyBadge+'<strong>'+recommendationDisplay(ctx,rec)+'</strong><span class="coachReason">'+mismatch+(reasonDisplay(ctx)||'현재 상황 기준 추천')+'</span>'+coachWhyHint();
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

  function historyStrategyMeta(coach){
    if(!coach?.mode)return {key:'unknown',label:'전략 기록 없음'};
    return strategyMeta(coach.mode);
  }

  function historyLieLabel(value){
    const v=String(value||'').toUpperCase();
    return ({
      TEE:'티',FAIRWAY:'페어웨이','A CUT':'A컷','B CUT':'B컷',
      ROUGH:'러프',BUNKER:'벙커',SAND:'벙커',GREEN:'그린',
      FRINGE:'프린지',RECOVERY:'트러블',HOLED:'홀아웃'
    })[v]||value||'미확인';
  }

  function historyDirectionLabel(value){
    const v=String(value||'').toUpperCase();
    if(['LEFT','CENTER','RIGHT'].includes(v))return targetDirectionDisplay(v);
    return value||'미확인';
  }

  function historyReasonText(coach){
    const reason=String(coach?.reason||'판단 이유 기록 없음');
    return reason
      .replaceAll('Landing Zone','랜딩 구역')
      .replaceAll('CENTER','중앙')
      .replaceAll('LEFT','좌측')
      .replaceAll('RIGHT','우측')
      .replaceAll('miss','미스');
  }

  function historyShotRows(h,r=safeRound()){
    if(!h)return [];
    const info=typeof sgBenchmarkInfo==='function'?sgBenchmarkInfo(r):null;
    return (h.shots||[]).map((s,i)=>{
      const coach=s?.targetScoreCoach||null;
      if(!coach)return null;
      const sg=typeof computeShotSG==='function'?computeShotSG(h,s,i,info):null;
      return {
        index:i+1,
        shot:s,
        coach,
        sg:Number.isFinite(Number(sg?.value))?Number(sg.value):null
      };
    }).filter(Boolean);
  }

  function historyFlow(rows){
    const flow=[];
    rows.forEach(row=>{
      const meta=historyStrategyMeta(row.coach);
      const last=flow[flow.length-1];
      if(!last||last.key!==meta.key)flow.push(meta);
    });
    return flow;
  }

  function historyMismatchCount(rows){
    return rows.filter(row=>{
      const c=row.coach;
      return c?.recommendedTarget&&c?.selectedTarget&&c.recommendedTarget!==c.selectedTarget;
    }).length;
  }

  function historyMatchCount(rows){
    return rows.filter(row=>{
      const c=row.coach;
      return c?.recommendedTarget&&c?.selectedTarget&&c.recommendedTarget===c.selectedTarget;
    }).length;
  }

  function historyStrategyBadges(flow){
    if(!flow.length)return '<span class="agentHistoryNoData">전략 기록 없음</span>';
    return flow.map(meta=>'<span class="agentHistoryStrategy '+htmlEscape(meta.key)+'">'+htmlEscape(meta.label)+'</span>').join('<span class="agentHistoryArrow">→</span>');
  }

  function historyShotResultText(row){
    const s=row?.shot||{};
    const parts=[historyLieLabel(s.endLie)];
    if(s.direction)parts.push(historyDirectionLabel(s.direction));
    if(Number.isFinite(row?.sg))parts.push('SG '+(row.sg>0?'+':'')+row.sg.toFixed(2));
    return parts.filter(Boolean).join(' · ');
  }

  function historyShotCardHtml(row){
    const c=row.coach||{};
    const meta=historyStrategyMeta(c);
    const recommended=c.recommendedTarget?targetDirectionDisplay(c.recommendedTarget):'기록 없음';
    const selected=c.selectedTarget?targetDirectionDisplay(c.selectedTarget):'기록 없음';
    const mismatch=Boolean(c.recommendedTarget&&c.selectedTarget&&c.recommendedTarget!==c.selectedTarget);
    const delta=num(c.planDeltaBefore);
    const deltaText=delta===null?'목표 흐름 기록 없음':targetProgressDisplay(delta);
    return '<div class="agentHistoryShot '+(mismatch?'mismatch':'')+'">'+
      '<div class="agentHistoryShotTop"><div><span>SHOT '+row.index+'</span><b>'+htmlEscape(row.shot?.club||'클럽 미확인')+'</b></div>'+
      '<span class="agentHistoryStrategy '+meta.key+'">'+htmlEscape(meta.label)+'</span></div>'+
      '<div class="agentHistoryDecision"><b>JGI 추천</b><span>'+htmlEscape(recommended)+'</span><b>플레이어 선택</b><span class="'+(mismatch?'different':'')+'">'+htmlEscape(selected)+(mismatch?' · 다름':'')+'</span></div>'+
      '<div class="agentHistoryReason">'+htmlEscape(deltaText)+' · '+htmlEscape(historyReasonText(c))+'</div>'+
      '<div class="agentHistoryResult"><b>결과</b><span>'+htmlEscape(historyShotResultText(row))+'</span></div>'+
      '</div>';
  }

  function historyHoleCompactHtml(h){
    const r=safeRound();
    const rows=historyShotRows(h,r);
    const flow=historyFlow(rows);
    const mismatches=historyMismatchCount(rows);
    const target=holeTarget(h?.hole,r);
    const actual=typeof holeScore==='function'?holeScore(h):null;
    const loss=holeLossPoint(h);
    const lossText=loss&&loss.sg<-0.02
      ?(loss.type==='PUTT'?'퍼트 '+loss.index:'샷 '+loss.index+' · '+loss.label)+' · SG '+(loss.sg>0?'+':'')+loss.sg.toFixed(2)
      :'큰 SG 손실 기록 없음';
    return '<div class="agentHistoryCompact">'+
      '<div class="agentHistoryCompactTop"><b>JGI 에이전트 히스토리</b><span>H'+htmlEscape(h?.hole||'—')+'</span></div>'+
      '<div class="agentHistoryScoreLine"><span>목표 '+(Number.isFinite(Number(target))?target:'—')+'</span><span>실제 '+(Number.isFinite(Number(actual))?actual:'—')+'</span></div>'+
      '<div class="agentHistoryFlow"><small>전략 흐름</small><div>'+historyStrategyBadges(flow)+'</div></div>'+
      '<div class="agentHistoryCompactGrid"><span>추천과 다른 선택</span><b>'+mismatches+'회</b><span>주요 손실</span><b>'+htmlEscape(lossText)+'</b></div>'+
      '<div class="dataNote">상황 → JGI 판단 → 플레이어 선택 → 결과를 Shot Snapshot으로 보존합니다.</div>'+
      '</div>';
  }

  function historyHoleDetailHtml(h){
    if(!h)return '<div class="agentHistoryEmpty">홀 데이터가 없습니다.</div>';
    const r=safeRound();
    const rows=historyShotRows(h,r);
    const flow=historyFlow(rows);
    const target=holeTarget(h.hole,r);
    const actual=typeof holeScore==='function'?holeScore(h):null;
    const mismatch=historyMismatchCount(rows);
    const match=historyMatchCount(rows);
    const loss=holeLossPoint(h);
    const lossText=loss&&Number.isFinite(loss.sg)
      ?(loss.type==='PUTT'?'퍼트 '+loss.index:'샷 '+loss.index+' · '+loss.label)+' · SG '+(loss.sg>0?'+':'')+loss.sg.toFixed(2)
      :'계산 가능한 SG 기록 없음';

    return '<div class="agentHistoryHoleHero">'+
      '<div><span>H'+h.hole+' · PAR '+(h.par||'—')+'</span><strong>'+(Number.isFinite(Number(actual))?actual:'—')+'</strong><small>목표 '+(Number.isFinite(Number(target))?target:'—')+'</small></div>'+
      '<div class="agentHistoryFlow large"><small>전략 흐름</small><div>'+historyStrategyBadges(flow)+'</div></div>'+
      '</div>'+
      '<div class="agentHistoryMiniStats">'+
        '<div><span>에이전트 기록</span><b>'+rows.length+'샷</b></div>'+
        '<div><span>추천 일치</span><b>'+match+'회</b></div>'+
        '<div><span>다른 선택</span><b>'+mismatch+'회</b></div>'+
      '</div>'+
      '<div class="agentHistoryLoss"><span>이 홀의 가장 큰 SG 손실</span><b>'+htmlEscape(lossText)+'</b></div>'+
      (rows.length?'<div class="agentHistoryTimeline">'+rows.map(historyShotCardHtml).join('')+'</div>':
        '<div class="agentHistoryEmpty">이 홀에는 저장된 JGI 에이전트 Shot Snapshot이 없습니다. 이전 버전 기록이거나 아직 샷이 확정되지 않은 홀일 수 있습니다.</div>')+
      '<div class="agentHistoryCaution">결과가 좋거나 나빴다는 사실만으로 당시 판단의 원인을 단정하지 않습니다.</div>';
  }

  function historyRoundRows(r=safeRound()){
    const rows=[];
    (r?.holes||[]).forEach(h=>{
      historyShotRows(h,r).forEach(row=>rows.push({...row,hole:h.hole,holeObj:h}));
    });
    return rows;
  }

  function historyRoundHtml(r=safeRound()){
    if(!r)return '<div class="agentHistoryEmpty">라운드 데이터가 없습니다.</div>';
    const rows=historyRoundRows(r);
    const counts={attack:0,defend:0,neutral:0,unknown:0};
    rows.forEach(row=>{const k=historyStrategyMeta(row.coach).key;counts[k]=(counts[k]||0)+1});
    const match=historyMatchCount(rows),mismatch=historyMismatchCount(rows);
    const completed=(r.holes||[]).filter(h=>h.completed);
    const holesHtml=(r.holes||[]).map(h=>{
      const hrows=historyShotRows(h,r),flow=historyFlow(hrows);
      const actual=typeof holeScore==='function'?holeScore(h):null;
      const target=holeTarget(h.hole,r);
      const hm=historyMismatchCount(hrows);
      return '<div class="agentHistoryRoundHole">'+
        '<div class="agentHistoryRoundHoleNo"><b>H'+h.hole+'</b><span>목표 '+(Number.isFinite(Number(target))?target:'—')+' / 실제 '+(Number.isFinite(Number(actual))?actual:'—')+'</span></div>'+
        '<div class="agentHistoryRoundFlow">'+historyStrategyBadges(flow)+'</div>'+
        '<span class="agentHistoryRoundMismatch">'+(hm?('다른 선택 '+hm+'회'):'추천 흐름 유지')+'</span>'+
        '</div>';
    }).join('');

    const observed=rows.length
      ?(mismatch>0?'JGI 추천과 다른 Target 선택이 '+mismatch+'회 기록되었습니다. 결과와의 관계는 각 Shot에서 별도로 확인합니다.':'현재 저장된 Agent Shot에서는 JGI 추천과 다른 Target 선택이 없습니다.')
      :'아직 집계할 JGI 에이전트 Shot Snapshot이 없습니다.';

    return '<div class="agentHistoryRoundHero"><span>현재 라운드</span><strong>'+completed.length+'홀 · '+rows.length+'개 Agent Shot</strong><p>'+htmlEscape(observed)+'</p></div>'+
      '<div class="agentHistoryRoundStats">'+
        '<div class="attack"><span>공격</span><b>'+counts.attack+'</b></div>'+
        '<div class="defend"><span>수비</span><b>'+counts.defend+'</b></div>'+
        '<div class="neutral"><span>기본</span><b>'+counts.neutral+'</b></div>'+
        '<div><span>추천 일치</span><b>'+match+'</b></div>'+
        '<div><span>다른 선택</span><b>'+mismatch+'</b></div>'+
        '<div><span>전략 미기록</span><b>'+counts.unknown+'</b></div>'+
      '</div>'+
      '<div class="agentHistorySectionTitle">홀별 전략 흐름</div>'+
      '<div class="agentHistoryRoundList">'+holesHtml+'</div>'+
      '<div class="agentHistoryCaution">이 화면은 각 Shot 당시 저장된 판단 Snapshot을 합산합니다. 추천과 결과의 상관관계를 인과로 단정하지 않습니다.</div>';
  }

  function historyDefaultHole(r=safeRound()){
    const completed=[...(r?.holes||[])].filter(h=>h.completed);
    if(completed.length)return Number(completed[completed.length-1].hole)||1;
    return Number(r?.currentHole)||1;
  }

  function renderAgentHistory(){
    const r=safeRound();
    const root=byId('agentHistoryBody');
    const tabs=byId('agentHistoryHoleTabs');
    const mode=byId('agentHistoryModeTabs');
    if(!root||!tabs||!mode)return;
    if(!Number.isFinite(Number(agentHistoryHole))||agentHistoryHole<1||agentHistoryHole>18)agentHistoryHole=historyDefaultHole(r);
    mode.querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b.dataset.historyMode===agentHistoryMode));
    tabs.classList.toggle('hidden',agentHistoryMode!=='HOLE');
    if(agentHistoryMode==='HOLE'){
      tabs.innerHTML=(r?.holes||[]).map(h=>{
        const has=historyShotRows(h,r).length>0;
        return '<button class="'+(Number(h.hole)===Number(agentHistoryHole)?'sel ':'')+(has?'has-data':'')+'" data-history-hole="'+h.hole+'">'+h.hole+'</button>';
      }).join('');
      const h=r?.holes?.[Number(agentHistoryHole)-1]||null;
      root.innerHTML=historyHoleDetailHtml(h);
    }else{
      tabs.innerHTML='';
      root.innerHTML=historyRoundHtml(r);
    }
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
    if(!p||!plan){host.innerHTML='목표 스코어 계획 준비 중';return}
    const status=targetProgressDisplay(p.delta);
    const statusClass=p.delta>0?'behind':p.delta<0?'ahead':'';
    const nextHole=(r.holes||[]).find(h=>!h.completed)?.hole||r.currentHole||18;
    const nextTarget=holeTarget(nextHole,r);
    const last=[...(r.holes||[])].filter(h=>h.completed).sort((a,b)=>b.hole-a.hole)[0]||null;
    host.innerHTML=
      '<div class="targetCoachOverviewTop"><div><span class="dataNote">목표 스코어</span><strong>'+plan.targetScore+'</strong></div><span class="targetCoachStatus '+statusClass+'">'+status+'</span></div>'+
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
    box.innerHTML=historyHoleCompactHtml(h);
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

  function pendingTargetPoint(latLng){
    if(!latLng)return null;
    const lat=typeof latLng.lat==='function'?Number(latLng.lat()):Number(latLng.lat);
    const lng=typeof latLng.lng==='function'?Number(latLng.lng()):Number(latLng.lng);
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  }

  function applyPendingTargetPoint(latLng){
    const r=safeRound(),p=r?.pending;
    if(!p||p.result||typeof googleMap==='undefined'||!googleMap||!window.google?.maps)return false;
    const point=pendingTargetPoint(latLng);if(!point)return false;
    const h=typeof hole==='function'?hole():null;
    const ch=typeof courseHoleData==='function'?courseHoleData():null;
    const start=p.start||(typeof activeTargetStartReference==='function'?activeTargetStartReference():null);
    if(!h||!ch||!start)return false;

    const zone=typeof inferZoneForPoint==='function'?inferZoneForPoint(ch,point,h.par):'CENTER';
    const model=typeof buildCourseIntelligenceModel==='function'?buildCourseIntelligenceModel(ch,h.par):null;
    const sec=model&&typeof nearestCenterSection==='function'?nearestCenterSection(model,point):null;
    const distanceM=typeof hav==='function'?hav(start,point):null;
    const target={
      zone,
      source:'PLAYER_SELECTED',
      lat:point.lat,
      lng:point.lng,
      distanceM:Number.isFinite(Number(distanceM))?Number(distanceM):null,
      fairwayWidthM:Number.isFinite(Number(sec?.widthM))?Number(sec.widthM):null,
      basis:'MAP_OVERRIDE'
    };

    targetZone=zone;
    targetZoneSource='PLAYER_SELECTED';
    targetManualOverride=true;
    targetDistanceReference=start;

    p.target=target;
    p.targetZone=zone;
    p.targetSource='PLAYER_SELECTED';
    p.targetLat=point.lat;
    p.targetLng=point.lng;
    p.targetFairwayWidthM=target.fairwayWidthM;

    const master=(typeof masterClubs!=='undefined'?masterClubs:[]).find(c=>c?.name===p.club);
    if(typeof deriveCourseIntelligence==='function'){
      p.courseContext={
        ...(p.courseContext||{}),
        ...deriveCourseIntelligence(ch,start,master?.carry??null,target,h.par)
      };
    }
    if(typeof inferShotIntent==='function'){
      p.shotIntent=inferShotIntent(p.courseContext?.startGreenDistanceM,target);
    }
    p.targetScoreCoach=buildShotContext(r,p.club,start,zone);

    if(typeof targetMarker!=='undefined'){
      if(!targetMarker){
        targetMarker=new google.maps.Marker({
          map:googleMap,position:point,draggable:true,title:'Target',zIndex:60,
          icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:'#ff8619',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3}
        });
      }else{
        targetMarker.setPosition(point);
        targetMarker.setMap(googleMap);
        targetMarker.setDraggable(true);
      }
    }
    if(typeof targetLine!=='undefined'){
      if(!targetLine){
        targetLine=new google.maps.Polyline({
          map:googleMap,strokeColor:'#ffffff',strokeOpacity:.9,strokeWeight:2,
          icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:1,scale:2},offset:'0',repeat:'12px'}]
        });
      }
      if(targetLine)targetLine.setPath([start,point]);
    }

    if(typeof updateTargetDistance==='function')updateTargetDistance();
    if(typeof renderTargetZoneControl==='function')renderTargetZoneControl();
    if(typeof syncMapFirstDistance==='function')syncMapFirstDistance();
    if(typeof renderJgiCourseView==='function')renderJgiCourseView();
    if(typeof save==='function')save();
    renderBar();
    return true;
  }

  function enablePendingTargetEditing(){
    const r=safeRound(),p=r?.pending;
    if(typeof targetMarker==='undefined'||!targetMarker)return;
    if(!p||p.result){
      try{targetMarker.setDraggable(false)}catch{}
      return;
    }
    try{targetMarker.setDraggable(true)}catch{}
    if(targetMarker.__jgiPendingTargetBound)return;
    targetMarker.__jgiPendingTargetBound=true;
    targetMarker.addListener('drag',()=>{
      if(safeRound()?.pending&&!safeRound().pending.result&&typeof updateTargetDistance==='function')updateTargetDistance();
    });
    targetMarker.addListener('dragend',()=>{
      const current=safeRound()?.pending;
      if(!current||current.result)return;
      const pos=targetMarker.getPosition();
      applyPendingTargetPoint(pos);
    });
  }

  function installPendingTargetMapHook(){
    const attach=()=>{
      if(typeof googleMap==='undefined'||!googleMap||googleMap.__jgiPendingTargetHook)return;
      googleMap.__jgiPendingTargetHook=true;
      googleMap.addListener('click',e=>{
        const r=safeRound();
        if(!r?.pending||r.pending.result)return;
        if(typeof reviewSatelliteActive!=='undefined'&&reviewSatelliteActive)return;
        if(typeof dropMode!=='undefined'&&dropMode)return;
        applyPendingTargetPoint(e.latLng);
      });
    };

    const base=window.initGoogleMap;
    if(typeof base==='function'&&!base.__jgiPendingTargetWrapped){
      const wrapped=function(){
        const out=base.apply(this,arguments);
        attach();
        return out;
      };
      wrapped.__jgiPendingTargetWrapped=true;
      window.initGoogleMap=wrapped;
    }
    attach();
  }

  function installUi(){
    const cockpit=document.querySelector('.mapFirstCockpit');
    const targetRow=cockpit?.querySelector('.mapFirstTargetRow');
    if(cockpit&&targetRow&&!byId('mapFirstCoachBar')){
      const bar=document.createElement('div');
      bar.id='mapFirstCoachBar';
      bar.className='mapFirstCoachBar';
      bar.innerHTML='<div class="mapFirstCoachBadge"><span>JGI 에이전트</span><b id="mapFirstCoachPlan">목표 기준</b></div><div id="mapFirstCoachText" class="mapFirstCoachText">JGI 에이전트 준비 중</div>';
      targetRow.insertAdjacentElement('afterend',bar);
    }

    const oldInline=byId('mapFirstCoachDetail');
    if(oldInline)oldInline.remove();

    const coachBar=byId('mapFirstCoachBar');
    if(coachBar&&!coachBar.__jgiDetailBound){
      coachBar.__jgiDetailBound=true;
      coachBar.setAttribute('role','button');
      coachBar.setAttribute('tabindex','0');
      coachBar.setAttribute('aria-label','JGI 추천 공략 판단 근거 보기');
      coachBar.setAttribute('aria-haspopup','dialog');
      coachBar.addEventListener('click',e=>{
        if(e.target?.closest?.('button,a,input,select,textarea'))return;
        openCoachModal();
      });
      coachBar.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          openCoachModal();
        }
      });
    }

    if(!byId('jgiCoachModal')){
      const modal=document.createElement('div');
      modal.id='jgiCoachModal';
      modal.className='jgiCoachModal';
      modal.hidden=true;
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-labelledby','jgiCoachModalTitle');
      modal.innerHTML=
        '<div class="jgiCoachModalPanel">'+
          '<div class="jgiCoachModalHead">'+
            '<div><span>JGI 에이전트</span><h3 id="jgiCoachModalTitle">왜 이렇게 판단했나요?</h3><p id="jgiCoachModalMeta">현재 홀 · 목표 기준</p></div>'+
            '<button id="jgiCoachModalClose" class="jgiCoachModalX" type="button" aria-label="닫기">×</button>'+
          '</div>'+
          '<div id="jgiCoachModalBody" class="jgiCoachModalBody"></div>'+
          '<div class="jgiCoachModalFoot"><button id="jgiCoachModalDone" type="button">닫기</button></div>'+
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{
        if(e.target===modal)closeCoachModal();
      });
      byId('jgiCoachModalClose')?.addEventListener('click',closeCoachModal);
      byId('jgiCoachModalDone')?.addEventListener('click',closeCoachModal);
      document.addEventListener('keydown',e=>{
        if(e.key==='Escape'&&!modal.hidden)closeCoachModal();
      });
    }

    const mainHost=document.querySelector('main');
    if(mainHost&&!byId('historyScreen')){
      const screen=document.createElement('section');
      screen.id='historyScreen';
      screen.className='screen hidden agentHistoryScreen';
      screen.innerHTML=
        '<div class="liveHead agentHistoryHead"><div><div class="eyebrow">JGI · DECISION HISTORY</div><h2>JGI 히스토리</h2><div class="sub">상황 → JGI 판단 → 플레이어 선택 → 결과</div></div></div>'+
        '<div id="agentHistoryModeTabs" class="agentHistoryModeTabs"><button class="sel" data-history-mode="HOLE">홀별</button><button data-history-mode="ROUND">18홀 전체</button></div>'+
        '<div id="agentHistoryHoleTabs" class="agentHistoryHoleTabs"></div>'+
        '<div id="agentHistoryBody"></div>';
      mainHost.appendChild(screen);
      screen.addEventListener('click',e=>{
        const modeBtn=e.target.closest('[data-history-mode]');
        if(modeBtn){
          agentHistoryMode=modeBtn.dataset.historyMode;
          renderAgentHistory();
          return;
        }
        const holeBtn=e.target.closest('[data-history-hole]');
        if(holeBtn){
          agentHistoryHole=Number(holeBtn.dataset.historyHole)||1;
          renderAgentHistory();
        }
      });
    }

    const bottom=byId('bottomnav');
    if(bottom&&!bottom.querySelector('[data-screen="history"]')){
      const btn=document.createElement('button');
      btn.dataset.screen='history';
      btn.innerHTML='<b>↺</b>기록';
      const overviewBtn=bottom.querySelector('[data-screen="overview"]');
      if(overviewBtn)overviewBtn.insertAdjacentElement('afterend',btn);
      else bottom.appendChild(btn);
    }

    const overview=document.querySelector('#overviewScreen .card');
    if(overview&&!byId('targetScoreCoachOverviewBody')){
      const card=document.createElement('div');
      card.className='card targetCoachOverview';
      card.innerHTML='<div class="title">JGI 목표 스코어 에이전트</div><div class="sub">목표 스코어 계획과 실제 플레이를 샷 단위로 비교합니다.</div><div id="targetScoreCoachOverviewBody" style="margin-top:10px"></div>';
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
      enablePendingTargetEditing();
      renderBar();
    }
  });

  wrap('updatePendingClub',function(ok){
    const r=safeRound();
    if(ok&&r?.pending){
      r.pending.targetScoreCoach=buildShotContext(r,r.pending.club,r.pending.start,r.pending.targetZone||r.pending.target?.zone||'CENTER');
      if(typeof save==='function')save();
      enablePendingTargetEditing();
      renderBar();
    }
  });

  wrap('lockPendingShotStart',function(ok){
    const r=safeRound(),p=r?.pending;
    if(ok&&p&&!p.result&&p.startLocked===true){
      p.targetScoreCoach=buildShotContext(r,p.club,p.start,p.targetZone||p.target?.zone||'CENTER');
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

  wrap('showScreen',function(out,pre,name){
    const screen=byId('historyScreen');
    if(screen)screen.classList.toggle('hidden',name!=='history');
    if(name==='history'){
      agentHistoryHole=agentHistoryHole||historyDefaultHole(safeRound());
      renderAgentHistory();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  });

  wrap('renderRound',function(){enablePendingTargetEditing();renderBar()});
  wrap('syncMapFirstUI',function(){enablePendingTargetEditing();renderBar()});
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

  installPendingTargetMapHook();
  const r=safeRound();
  if(r){r.targetScoreCoachVersion=VERSION;ensurePlan(r);if(typeof save==='function')save()}
  enablePendingTargetEditing();
  renderBar();
})();
