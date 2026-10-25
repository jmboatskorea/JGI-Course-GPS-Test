/* Read-only Course Lesson adapter for the existing individual ROUND SG and review UI. */
(function(){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
  const coordinate=p=>p&&typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
  const knownLie=lie=>lie==='HOLED'||window.sgLieKey(lie)!==null;

  function polygonLie(point,hole,r,shot){
    if(!coordinate(point))return 'UNKNOWN';
    const data=window.activeCourseData(r),ch=data?.holes?.[String(hole)];
    // Never reclassify a historic point against a different geometry version.
    const version=shot.courseContext?.geometryVersion||r.courseVersion;
    if(version&&version!==data?.version)return 'UNKNOWN';
    const lies=['GREEN','BUNKER','TEE','FAIRWAY','ROUGH'];
    const polygons=window.courseShapes(ch,r).filter(s=>!s.line&&s.path.length>=3);
    for(const lie of lies){
      const hit=polygons.find(s=>s.type===lie&&window.pointInPolygonXY({x:point.lng,y:point.lat},s.path.map(p=>({x:p.lng,y:p.lat}))));
      if(!hit)continue;
      const margin=Math.min(...hit.path.map((a,i)=>{
        const b=hit.path[(i+1)%hit.path.length];
        return window.pointToGeoSegmentDistanceM(point,[a.lat,a.lng],[b.lat,b.lng]);
      }));
      // A boundary point or a GPS accuracy circle crossing the polygon is not reliable Lie evidence.
      if(margin<=0.05||(finite(point.accuracy)&&Number(point.accuracy)>margin))return 'UNKNOWN';
      return lie;
    }
    return 'UNKNOWN'; // A hole boundary alone is not evidence of Rough or Tee.
  }

  function build(player){
    if(!player?.registered||!player.round)throw Error('등록된 선수를 선택하세요.');
    const r=copy(player.round),lies=[];
    for(const h of r.holes){
      if(!finite(h.teeDistanceM))delete h.teeDistanceM;
      for(const [i,s] of h.shots.entries()){
        for(const side of ['start','end']){
          const key=side+'Lie';
          if(!coordinate(s[side])){s[side]=null;if(side==='start'||!['GREEN','HOLED'].includes(s[key]))s[key]='UNKNOWN';}
          if(!knownLie(s[key])){
            s[key]=polygonLie(s[side],h.hole,r,s);
            lies.push({hole:h.hole,shot:i+1,side,lie:s[key]});
          }
        }
        // Keep missing distances missing: the legacy numeric helpers otherwise coerce null to zero.
        for(const key of ['startGreenDistanceM','greenDistanceM','endGreenDistanceM','distanceToGreenEdgeM','greenEdgeDistanceM']){
          if(s.courseContext&&!finite(s.courseContext[key]))delete s.courseContext[key];
        }
      }
      for(const p of h.puttsDetail||[])if(!finite(p.distanceM))delete p.distanceM;
    }
    const sg=window.sgRoundSummary(r),records=[],missing={ott:0,app:0,arg:0,putt:0,unknown:0};
    for(const h of r.holes){
      h.shots.forEach((s,i)=>{
        const value=window.computeShotSG(h,s,i,sg.info,r);
        const category=window.sgLieKey(s.startLie)?window.sgShotCategory(h,s,i,r):'unknown';
        let reason=null;
        if(!value){
          if(!window.sgLieKey(s.startLie))reason='시작 Lie 미확인';
          else if(!Number.isFinite(window.shotStartDistanceToHoleM(h,s,i,r)))reason='시작 거리 미확정';
          else if(!knownLie(s.endLie))reason='종료 Lie 미확인';
          else if(s.endLie==='GREEN'&&!finite(h.puttsDetail?.[0]?.distanceM))reason='실제 첫 퍼팅 거리 기록 대기';
          else if(!Number.isFinite(window.shotEndDistanceToHoleM(h,s,i,r)))reason='종료 거리 미확정';
          else reason='기존 Benchmark 적용 범위 밖 또는 데이터 부족';
          missing[category]++;
        }
        records.push({hole:h.hole,kind:'SHOT',number:i+1,category,value:value?.value??null,reason});
      });
      (h.puttsDetail||[]).forEach((p,i)=>{
        const value=window.computePuttSG(h,p,i,sg.info),reason=value?null:(!finite(p.distanceM)?'퍼팅 거리 미확정':p.result!=='HOLED'&&!finite(h.puttsDetail[i+1]?.distanceM)?'다음 실제 퍼팅 거리 기록 대기':'기존 Benchmark 적용 범위 밖 또는 데이터 부족');
        if(!value)missing.putt++;
        records.push({hole:h.hole,kind:'PUTT',number:i+1,category:'putt',value:value?.value??null,reason});
      });
    }
    const sgValues={sgTotal:records.length&&!sg.counts.missing?sg.total:null};
    for(const [id,key] of [['sgOtt','ott'],['sgApp','app'],['sgArg','arg'],['sgPutt','putt']])sgValues[id]=sg.counts[key]&&!missing[key]?sg.totals[key]:null;
    return {round:r,sg,sgValues,records,lies,complete:r.holes.length===18&&r.holes.every(h=>h.completed)};
  }

  function analysis(r){
    const a=window.buildLiveAnalysis(r,false);
    // Reuse ROUND's criteria only where the Lesson actually collected their required inputs.
    const rows=r.holes.filter(h=>h.completed||h.hole===r.currentHole).flatMap(h=>h.shots.map((s,i)=>({s,cat:window.playerShotCategory(h,s,i,r)})));
    const map={tee:'TEE',second:'SECOND',third:'THIRD',approach:'APPROACH'};
    for(const [key,cat] of Object.entries(map)){
      const shots=rows.filter(x=>x.cat===cat).map(x=>x.s),card=a.categories[key];
      if(!shots.length)continue;
      const unknown=shots.filter(s=>!knownLie(s.endLie)).length;
      if(unknown){card.issue=0;card.why='종료 Lie 미확인 '+unknown+'개 · 반복 미스 판단 데이터 부족';}
      if(!shots.some(s=>s.direction||s.depth))card.sub='방향 · SHORT/LONG 결과 입력 데이터 부족'+(unknown?' · Lie 미확인 '+unknown+'개':'');
      if(key==='tee'&&unknown)card.sub+=' · 페어웨이 적중 여부 미계산 포함';
    }
    const observed=Object.values(a.categories).filter(c=>c.samples&&c.issue>0);
    if(!observed.length){
      a.whatHappened='현재 기록에서 반복 미스를 판단할 근거가 부족합니다.';
      a.nextAction='추가 기록 후 기존 ROUND 기준으로 다시 확인하세요.';
    }
    return a;
  }

  let dialog=null;
  function open(player){
    if(dialog?.open)return;
    const snapshot=build(player);
    dialog?.remove();
    const root=document.createElement('dialog');dialog=root;root.className='lessonReportDialog';root.setAttribute('aria-labelledby','lessonReportTitle');
    root.innerHTML='<div class="app"><header class="lessonReportHeader"><div><h2 id="lessonReportTitle"></h2><p class="sub" id="lessonReportStatus"></p></div><button type="button" class="x" data-report-close aria-label="선수 리포트 닫기">✕</button></header><nav class="perfTabs lessonReportTabs" aria-label="선수 리포트 화면"><button type="button" class="sel" data-report-tab="overviewScreen">라운드 리뷰</button><button type="button" data-report-tab="performanceScreen">퍼포먼스 · SG</button></nav><div data-report-content></div></div>';
    const ids=new Map(),content=root.querySelector('[data-report-content]');
    for(const name of ['overviewScreen','performanceScreen']){
      const section=document.getElementById(name).cloneNode(true);section.classList.toggle('hidden',name!=='overviewScreen');
      for(const node of [section,...section.querySelectorAll('[id]')]){
        ids.set(node.id,node);node.id='lessonReport-'+node.id;
      }
      // Events in this clone are handled locally, never by the personal ROUND handlers.
      for(const node of section.querySelectorAll('[onclick]'))node.removeAttribute('onclick');
      section.querySelector('#lessonReport-ovFlo')?.closest('.metric').remove();
      section.querySelector('#lessonReport-ovHoles')?.closest('.grid4').classList.replace('grid4','grid3');
      section.querySelector('[data-review-map="SAT"]')?.remove(); // Keep the shared live map session in place.
      content.append(section);
    }
    const view={...snapshot,get:id=>ids.get(id),performanceView:'CLUB',selectedClub:null,selectedDistance:null,selectedReviewHole:null,analysis:analysis(snapshot.round)};
    document.body.append(root);
    try{
      window.renderOverview(view);window.render퍼포먼스(view);
      view.get('reviewMapToggle').querySelector('[data-review-map="JGI"]').classList.add('sel');
      for(const [id,value] of Object.entries(view.sgValues))if(value===null)view.get(id).classList.add('lessonSgPending');
      const putts=view.round.holes.reduce((sum,h)=>sum+(h.putts||0),0),penalties=view.round.holes.reduce((sum,h)=>sum+(h.penalties||0),0);
      for(const id of ['ovPutts','statPutts'])view.get(id).textContent=putts;
      view.get('statPen').textContent=penalties;
      view.get('overviewEyebrow').textContent=snapshot.complete?'JGI · FINAL ROUND REPORT':'JGI · 진행 중인 개인 라운드';
      root.querySelector('#lessonReportTitle').textContent=player.profile.name+' · REPORT';
      root.querySelector('#lessonReportStatus').textContent=(snapshot.complete?'18홀 완료':'진행 중 · '+snapshot.round.holes.filter(h=>h.completed).length+'/18홀 완료')+' · '+snapshot.sg.info.label;
      const coach=view.get('targetScoreCoachOverviewBody');
      if(coach)coach.textContent='저장된 목표 스코어 · 샷 의사결정 데이터 부족';
      window.JGI_ROUND_REPORT_RENDERERS.renderFinalReport(view);
      if(!snapshot.complete)view.get('finalRoundReportCard').querySelector('.title').textContent='JGI ROUND REPORT · 진행 중';
      const note=document.createElement('div');note.className='dataNote';note.setAttribute('data-report-missing','');
      const missing=snapshot.records.filter(x=>x.reason),reasons=[...new Set(missing.map(x=>x.reason))];
      note.textContent='SG '+(snapshot.records.length-missing.length)+'/'+snapshot.records.length+'개 계산 · '+(missing.length?reasons.join(' · '):snapshot.records.length?'기존 ROUND 공식과 Benchmark 적용':'기록 데이터 부족')+' · 벌타 '+(-snapshot.sg.totals.penalty)+'타는 Total에 1회만 반영하며 샷 범주에 배분하지 않습니다. Lie 분류는 리포트 사본에만 적용합니다.';
      view.get('sgPenaltyNote').after(note);
      const quality=document.createElement('div');quality.className='dataNote';quality.textContent='종료 Lie · 방향 · 탄도 · 목표 결정이 저장되지 않은 항목은 확인 또는 분석할 수 없습니다. Score / To Par / 적중률은 기존 ROUND의 완료 홀 기준이며, Total Putts / Penalty / SG는 현재 저장된 기록을 포함합니다.';
      view.get('liveCategoryCards').after(quality);
      const status=view.get('performanceScreen').querySelector('.sgStatus');
      status.textContent=snapshot.sg.info.label+' · '+(snapshot.round.sgProfileVersion||snapshot.round.sgDataVersion||'기존 ROUND Benchmark')+' · 기존 ROUND 적용 범위를 벗어난 항목은 미계산';
      const uncertain=snapshot.round.holes.filter(h=>h.completed).some(h=>h.shots.some(s=>!knownLie(s.endLie)));
      if(uncertain){view.get('statFir').textContent='미계산';view.get('statGir').textContent='미계산';view.get('statScramble').textContent='미계산';}
      root.showModal();
    }catch(error){root.remove();if(dialog===root)dialog=null;throw error;}
    root.addEventListener('click',event=>{
      const button=event.target.closest('button,[data-performance-club],[data-performance-distance]');if(!button)return;
      if(button.hasAttribute('data-report-close')){root.close();return;}
      if(button.dataset.reportTab){
        for(const name of ['overviewScreen','performanceScreen'])view.get(name).classList.toggle('hidden',name!==button.dataset.reportTab);
        root.querySelectorAll('[data-report-tab]').forEach(b=>b.classList.toggle('sel',b===button));root.scrollTop=0;
      }
      if(button.dataset.reviewHole){view.selectedReviewHole=Number(button.dataset.reviewHole);view.get('reviewHoleTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b===button));window.renderHoleReview(view.selectedReviewHole,view);}
      if(button.dataset.performanceView)view.performanceView=button.dataset.performanceView;
      if(button.dataset.performanceClub){view.selectedClub=decodeURIComponent(button.dataset.performanceClub);view.performanceView='CLUB';}
      if(button.dataset.performanceDistance){view.selectedDistance=decodeURIComponent(button.dataset.performanceDistance);view.performanceView='DISTANCE';}
      if(button.dataset.performanceView||button.dataset.performanceClub||button.dataset.performanceDistance)window.renderClubDistanceSg(view);
      if(button.dataset.q){
        const a=view.analysis;
        view.get('askJgiAnswer').textContent=button.dataset.q==='problem'?a.whatHappened+' '+a.problem.sub:button.dataset.q==='working'?a.working.main:a.nextAction;
      }
    });
    root.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-performance-club],[data-performance-distance]')){event.preventDefault();event.target.click();}});
    root.addEventListener('close',()=>{root.remove();if(dialog===root)dialog=null;},{once:true});
  }
  window.JGICourseLessonReport=Object.freeze({build,open});
})();
