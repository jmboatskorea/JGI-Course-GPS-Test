/* Single-player, single-round view of the existing cumulative report components. */
(function(){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const known=lie=>window.sgLieKey(lie)!==null||lie==='HOLED';
  const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sg=value=>finite(value)?window.multiSgHtml(value):'미계산';
  const noData='<div class="analysisEmpty">데이터 부족</div>';
  const table=(head,rows)=>rows.length?window.multiTable(head,rows):noData;
  const tile=(label,value,sample='')=>window.multiMetricTile(label,value,sample);
  const rate=x=>x&&finite(x.rate)?Math.round(x.rate)+'%':'데이터 부족';
  const sample=x=>x?.total?x.hit+' / '+x.total:'데이터 부족';
  const categories=[['ott','OTT','sgOtt'],['app','APP','sgApp'],['arg','ARG','sgArg'],['putt','PUTT','sgPutt']];

  function build(player){
    const full=window.JGICourseLessonReport.build(player);
    const view=window.JGICourseLessonReport.build({...player,round:{...full.round,holes:full.round.holes.filter(h=>h.completed)}});
    const r=view.round,holes=r.holes;
    // Supply explicit-player geometry to legacy pure counting helpers in this derived copy only.
    holes.forEach(h=>h.shots.forEach(s=>{
      const edge=window.distanceToGreenEdgeM(h,s,r);
      if(finite(edge))s.courseContext={...s.courseContext,distanceToGreenEdgeM:edge};
    }));
    const ratesFor=selected=>window.multiCorePerformanceRates([{...r,holes:selected}]);
    const girKnown=h=>{
      const limit=window.multiRegulationShotIndex(h.par);if(limit===null)return false;
      const shots=h.shots.slice(0,limit+1);
      return shots.some(window.multiShotReachedGreenOrHoled)||(shots.length===limit+1&&shots.every(s=>known(s.endLie)));
    };
    const fairwayHoles=holes.filter(h=>Number(h.par)>=4&&h.shots[0]&&known(h.shots[0].endLie));
    const girHoles=holes.filter(girKnown);
    const core={FAIRWAY:ratesFor(fairwayHoles).FAIRWAY,GIR:ratesFor(girHoles).GIR,RECOVERY:ratesFor(girHoles).RECOVERY,BUNKER_SAVE:ratesFor(holes).BUNKER_SAVE};
    // A customer-facing rate must not silently treat unconfirmed holes as misses or as a full sample.
    if(holes.some(h=>Number(h.par)>=4&&(!h.shots[0]||!known(h.shots[0].endLie))))core.FAIRWAY={...core.FAIRWAY,rate:null,insufficient:true};
    if(girHoles.length<holes.length){
      for(const key of ['GIR','RECOVERY'])core[key]={...core[key],rate:null,insufficient:true};
    }
    // Unknown starts or missing green-edge evidence can conceal a bunker opportunity.

    if(holes.some(h=>h.shots.some(s=>!known(s.startLie)||(['BUNKER','SAND'].includes(s.startLie)&&!finite(s.courseContext?.distanceToGreenEdgeM))))){
      core.BUNKER_SAVE={...core.BUNKER_SAVE,rate:null,insufficient:true};
    }
    const nonBunker={hit:0,total:0};
    holes.forEach(h=>{const x=window.multiHoleNonBunkerSaveCounts(h);nonBunker.hit+=x.hit;nonBunker.total+=x.total;});
    nonBunker.insufficient=holes.some(h=>h.shots.some(s=>!known(s.startLie)||(!['TEE','GREEN','HOLED','BUNKER','SAND'].includes(s.startLie)&&!finite(s.courseContext?.distanceToGreenEdgeM))));
    nonBunker.rate=!nonBunker.insufficient&&nonBunker.total?nonBunker.hit/nonBunker.total*100:null;
    const shots=holes.flatMap(h=>h.shots.map((s,i)=>({h,s,i,record:view.records.find(x=>x.hole===h.hole&&x.kind==='SHOT'&&x.number===i+1)})));
    const putts=holes.flatMap(h=>h.puttsDetail.map((p,i)=>({h,p,i,record:view.records.find(x=>x.hole===h.hole&&x.kind==='PUTT'&&x.number===i+1)})));
    const puttGroups={};
    putts.forEach(x=>{
      if(!finite(x.p.distanceM))return;
      const key=window.multiPuttBucket(x.p.distanceM);if(!key)return;
      const g=puttGroups[key]||(puttGroups[key]={label:key,n:0,holed:0,short:0,long:0,sg:[],missing:0});
      g.n++;if(x.p.result==='HOLED')g.holed++;if(x.p.result==='SHORT')g.short++;if(x.p.result==='LONG')g.long++;
      if(finite(x.record?.value))g.sg.push(x.record.value);else g.missing++;
    });
    const distances=new Map();
    shots.forEach(x=>{
      const start=window.shotStartDistanceToHoleM(x.h,x.s,x.i,r),bucket=finite(start)?window.performanceDistanceBucket(x.h,x.s,x.i,r):{label:'거리 미확정',order:9999};
      const g=distances.get(bucket.label)||{label:bucket.label,order:bucket.order,n:0,sg:[],missing:0};g.n++;
      if(finite(x.record?.value))g.sg.push(x.record.value);else g.missing++;distances.set(bucket.label,g);
    });
    const clubs=new Map();
    shots.forEach(x=>{
      const key=x.s.club||'미확인',g=clubs.get(key)||{key,n:0,dist:[],sg:[],missing:0,left:0,center:0,right:0};
      g.n++;if(finite(x.s.distanceM))g.dist.push(x.s.distanceM);
      if(finite(x.record?.value))g.sg.push(x.record.value);else g.missing++;
      const direction=String(x.s.direction||'').toLowerCase();if(['left','center','right'].includes(direction))g[direction]++;
      clubs.set(key,g);
    });
    const score=holes.length?window.resultScore(r):null,par=window.resultPar(r);
    const toPar=holes.length&&holes.every(h=>finite(h.par)&&h.par>0)?window.resultToPar(r):null;
    return {full,view,round:r,core,nonBunker,girHoles,shots,putts,puttGroups,clubs:[...clubs.values()].sort((a,b)=>b.n-a.n),score,toPar,par,
      distances:[...distances.values()].sort((a,b)=>a.order-b.order),puttCount:putts.length,penalties:holes.reduce((sum,h)=>sum+(h.penalties||0),0),handicap:player.profile.handicap};
  }

  function styles(root,ids){
    // Reuse the actual loaded stylesheet, including all media rules. The original stays untouched.
    const source=[...document.styleSheets].find(s=>s.href&&new URL(s.href).pathname.endsWith('/cumulative-report.css'));
    if(!source)throw Error('기존 종합 리포트 스타일을 불러오지 못했습니다.');
    let css=[...source.cssRules].map(rule=>rule.cssText).join('\n');
    for(const [id,node] of [...ids].sort((a,b)=>b[0].length-a[0].length))css=css.replaceAll('#'+id,'#'+node.id);
    css=css.replaceAll('.multi-review-open .app','.lessonReportDialog.lessonSummaryOpen>.app');
    const style=document.createElement('style');style.textContent=css;root.append(style);
  }

  function mount(root,player){
    const data=build(player),{view,round:r}=data;
    const original=document.getElementById('resultsMultiView'),pane=original.cloneNode(false);pane.id='lessonReport-summaryScreen';pane.className='screen hidden';
    // Clone the real component shells, leaving multi-round controls and state analysis out.
    const picks=['.multiPageHead','.multiHero','.multiSgOverview','#multiCoreInsights','#multiDashboardTabs','.multiPrimaryCard'];
    for(const selector of picks){const node=original.querySelector(selector);pane.append((selector==='#multiCoreInsights'?node.closest('.card'):node).cloneNode(true));}
    const ids=new Map([['resultsMultiView',pane]]);
    for(const node of pane.querySelectorAll('[id]')){const id=node.id;node.id='lessonSummary-'+id;ids.set(id,node);}
    const get=id=>ids.get(id);
    pane.querySelector('.multiRangeTabs')?.remove();
    get('multiSgTrend')?.remove();
    pane.querySelectorAll('.multiHcpProgress').forEach(node=>node.remove());
    get('multiPenalty').textContent=data.penalties;
    get('multiDashboardTabs').querySelector('[data-multi-dashboard="MENTAL"]').remove();
    pane.querySelectorAll('[onclick]').forEach(node=>node.removeAttribute('onclick'));
    pane.querySelectorAll('.multiDetailActions').forEach(node=>node.remove());
    pane.querySelector('.multiPageHead h1').textContent='JGI · 개인별 종합 리포트';
    pane.querySelector('.multiPageHead p').textContent='선택 선수의 단일 라운드 · 완료한 홀 기준';
    get('multiReviewTitle').textContent=player.profile.name;
    get('multiReviewSub').textContent=(data.full.complete?'18홀 완료 · FINAL ROUND REPORT':'진행 중 · 완료 '+r.holes.length+'/18홀')+' · '+r.course+' · '+r.nine+' · '+r.tee+' Tee';
    const labels=[data.full.complete?'FINAL SCORE':'CURRENT SCORE','TO PAR','TOTAL PUTTS','PLAYER HCP'];
    const values=[data.score??'—',data.toPar===null?'데이터 부족':data.toPar===0?'E':(data.toPar>0?'+':'')+data.toPar,data.puttCount,data.handicap.toFixed(1)];
    pane.querySelectorAll('.multiCockpitSummary>.resultsMetric').forEach((card,i)=>{card.querySelector('b').textContent=values[i];card.querySelector('span').textContent=labels[i];card.dataset.summaryMetric=['score','toPar','putts','hcp'][i];});
    get('multiCoreRateCards').innerHTML=window.multiCoreRateCardsHtml([r]);
    Object.entries(data.core).forEach(([key,value],i)=>{
      const card=get('multiCoreRateCards').children[i];card.dataset.summaryCore=key;card.querySelector('b').textContent=rate(value);card.querySelector('small').textContent=value.insufficient?'데이터 부족':sample(value);
    });
    pane.querySelector('.multiSgOverview>.sectionLabel').textContent='STROKES GAINED · 단일 라운드';
    get('multiSgBenchmark').textContent=view.sg.info.label+' · '+(r.sgProfileVersion||r.sgDataVersion||'기존 ROUND Benchmark');
    get('multiPlayerSgCards').innerHTML=categories.map(([key,label,id])=>'<div class="multiPlayerSgCard" data-summary-sg="'+key+'"><span>SG '+label+'</span><b>'+sg(view.sgValues[id])+'</b><small>완료한 홀 기록</small></div>').join('')+
      '<div class="multiPlayerSgCard" data-summary-sg="total"><span>SG TOTAL</span><b>'+sg(view.sgValues.sgTotal)+'</b><small>벌타 '+data.penalties+'타 1회 반영 · 범주별 임의 배분 없음</small></div>';
    const evidence=document.createElement('div');evidence.className='analysisNote';evidence.textContent='종합 통계는 완료한 '+r.holes.length+'홀만 포함합니다. 진행 중인 홀은 Hole-by-Hole에서 별도 표시합니다. SG '+view.records.filter(x=>finite(x.value)).length+'/'+view.records.length+'개 계산 · '+([...new Set(view.records.filter(x=>x.reason).map(x=>x.reason))].join(' · ')||'기존 ROUND 공식 적용')+' · 근거 없는 지표는 데이터 부족으로 표시합니다.';get('multiPlayerSgCards').after(evidence);
    const strength=categories.map(([key,label,id])=>({key,label,value:view.sgValues[id]})).filter(x=>finite(x.value));
    get('multiCoreInsights').closest('.card').querySelector('.title').textContent='Biggest Gains / Losses';
    get('multiCoreInsights').innerHTML=[['gain','Biggest Gains',strength.filter(x=>x.value>0).sort((a,b)=>b.value-a.value)[0]],['loss','Biggest Losses',strength.filter(x=>x.value<0).sort((a,b)=>a.value-b.value)[0]]].map(([cls,label,x])=>'<div class="multiCoreInsight '+cls+'"><div class="ey">'+label+'</div><strong>'+(x?x.label+' '+window.multiSigned(x.value):strength.length?(cls==='gain'?'획득 SG 없음':'손실 SG 없음'):'데이터 부족')+'</strong><p>완료한 홀의 계산 가능한 SG 범주 기준 · 미계산 범주 제외</p></div>').join('');

    const scoring=window.multiScoringPerformanceStats([r]);
    const scoringHtml=()=>'<div class="multiTeeKpis">'+tile('Score',data.score??'데이터 부족',r.holes.length+' holes')+tile('To Par',data.toPar===null?'데이터 부족':data.toPar===0?'E':window.multiSigned(data.toPar,0))+Object.entries(scoring.parStats).map(([par,x])=>tile('Par '+par+' Score',x.n?x.score:'데이터 부족',x.n+' holes')).join('')+tile('Birdie %',rate(scoring.birdie),sample(scoring.birdie))+tile('Par Break %',rate(scoring.parBreak),sample(scoring.parBreak))+'</div>';
    const ball=window.multiBallStrikingStats([{...r,holes:data.girHoles}]);
    const ballHtml=()=>'<div class="multiTeeKpis">'+tile('Fairway %',rate(data.core.FAIRWAY),sample(data.core.FAIRWAY))+Object.entries(ball.parGir).map(([par,x])=>tile('Par '+par+' GIR',rate(x),sample(x))).join('')+tile('Penalty Total',data.penalties)+'</div>';
    const shortGameHtml=()=>'<div class="multiTeeKpis">'+tile('Recovery %',rate(data.core.RECOVERY),sample(data.core.RECOVERY))+tile('Bunker Save %',rate(data.core.BUNKER_SAVE),data.core.BUNKER_SAVE.insufficient?'데이터 부족':sample(data.core.BUNKER_SAVE))+tile('Non-Bunker Save %',rate(data.nonBunker),data.nonBunker.insufficient?'데이터 부족':sample(data.nonBunker))+tile('SG ARG',sg(view.sgValues.sgArg))+'</div>';
    const sgHtml=()=>'<div class="multiTeeKpis">'+tile('SG TOTAL',sg(view.sgValues.sgTotal),'Penalty '+data.penalties)+categories.map(([,label,id])=>tile('SG '+label,sg(view.sgValues[id]))).join('')+'</div>';
    const puttingHtml=()=>'<div class="multiTeeKpis">'+tile('Total Putts',data.puttCount,r.holes.length+' completed holes')+tile('1-Putt Holes',r.holes.filter(h=>h.puttsDetail.length===1).length)+tile('3+ Putt Holes',r.holes.filter(h=>h.puttsDetail.length>=3).length)+tile('SG PUTT',sg(view.sgValues.sgPutt))+'</div>'+(data.putts.length?'<div class="multiTeeGrid"><div class="multiVizCard"><h4>퍼팅 거리별 기록</h4>'+window.multiPuttDistanceBarsHtml(data.puttGroups)+'</div><div class="multiVizCard"><h4>거리별 성공</h4>'+window.multiPuttSuccessBarsHtml(data.puttGroups)+'</div></div>':'')+table(['거리','Putts','HOLED','SHORT','LONG','SG Total'],Object.values(data.puttGroups).map(g=>[esc(g.label),g.n,g.holed,g.short,g.long,sg(!g.missing&&g.sg.length?g.sg.reduce((sum,n)=>sum+n,0):null)]))+'<div class="analysisNote">경사 · 브레이크 입력은 데이터 부족입니다. 입력되지 않은 방향이나 경사를 추정하지 않습니다.</div>';
    const clubHtml=()=>'<div class="multiTeeGrid"><div class="multiVizCard"><h4>클럽 사용 빈도</h4>'+window.multiClubUsageBarsHtml(data.clubs)+'</div><div class="multiVizCard"><h4>클럽별 방향 결과</h4>'+window.multiClubMissSplitHtml(data.clubs)+'</div></div>'+table(['클럽','Shot','기록 거리 범위','SG Total'],data.clubs.map(g=>[esc(g.key),g.n,g.dist.length?Math.round(Math.min(...g.dist))+'–'+Math.round(Math.max(...g.dist))+'m':'데이터 부족',sg(!g.missing&&g.sg.length?g.sg.reduce((sum,n)=>sum+n,0):null)]))+table(['시작 거리 구간','Shot','SG Total'],data.distances.map(g=>[esc(g.label),g.n,sg(!g.missing&&g.sg.length?g.sg.reduce((sum,n)=>sum+n,0):null)]));
    const penaltyRows=r.holes.flatMap(h=>(h.penaltyEvents||[]).map(p=>['H'+h.hole,esc(window.multiPenaltyLabel(p.type)),p.strokes]));
    const penaltyHtml=()=>'<div class="multiTeeKpis">'+tile('Penalty Total',data.penalties,'완료한 홀')+'</div>'+table(['홀','유형','벌타'],penaltyRows)+'<div class="analysisNote">벌타는 홀 단위 이벤트이며 원인 클럽이나 SG 범주를 임의로 지정하지 않습니다.</div>';
    const holeTable=()=>table(['Hole','Par','Score','To Par','Putts','Penalty','상태'],data.full.round.holes.filter(h=>h.completed||h.shots.length||h.puttsDetail.length||h.penalties).map(h=>['H'+h.hole,h.par??'데이터 부족',h.completed?window.storedHoleScore(h):'합산 제외',h.completed&&finite(h.par)?window.multiSigned(window.storedHoleScore(h)-h.par,0):'데이터 부족',h.puttsDetail.length,h.penalties||0,h.completed?'완료':'진행 중']));
    get('multiDashboardTabs').querySelectorAll('button').forEach(b=>{b.dataset.summaryDashboard=b.dataset.multiDashboard;delete b.dataset.multiDashboard;});
    let dashboard='PERFORMANCE',performance='SCORING';
    function primary(){
      get('multiDashboardTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b.dataset.summaryDashboard===dashboard));
      get('multiPrimaryTitle').textContent=dashboard==='CLUB'?'클럽 · 거리 분석':dashboard==='COURSE'?'코스 · 홀별 기록':'경기력 분석';
      get('multiPrimarySub').textContent='선택 선수의 단일 라운드 · 완료한 홀 기준';
      const tabs='<div class="multiCategoryTabs">'+[['SCORING','스코어'],['BALL','볼 스트라이킹'],['SHORT_GAME','숏게임'],['PUTTING','퍼팅'],['SG','SG']].map(([key,label])=>'<button type="button" class="'+(performance===key?'sel':'')+'" data-summary-performance="'+key+'">'+label+'</button>').join('')+'</div>';
      get('multiPrimaryDetail').innerHTML=dashboard==='CLUB'?clubHtml():dashboard==='COURSE'?holeTable():tabs+({SCORING:scoringHtml,BALL:ballHtml,SHORT_GAME:shortGameHtml,PUTTING:puttingHtml,SG:sgHtml}[performance])();
    }
    primary();
    const extra=document.createElement('div');extra.innerHTML=[['Hole-by-Hole',holeTable()+data.full.round.holes.filter(h=>h.completed||h.shots.length||h.puttsDetail.length).map((h,i)=>window.multiShotHoleDetailHtml(data.full.round,h,i===0,data.full)).join('')],['Club / Distance 분석',clubHtml()],['Putting 분석',puttingHtml()],['Penalty 분석',penaltyHtml()]].map(([title,html])=>'<div class="card"><div class="title">'+title+'</div>'+html+'</div>').join('');pane.append(extra);
    // Make the incomplete-hole label explicit in the original Shot/Hole component shells.
    extra.querySelectorAll('.multiShotHole').forEach((node,i)=>{const h=data.full.round.holes.filter(h=>h.completed||h.shots.length||h.puttsDetail.length)[i];if(!h.completed)node.querySelector('summary b').textContent='진행 중 · 종합 통계 합산 제외';});
    styles(root,ids);root.querySelector('[data-report-content]').append(pane);
    pane.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.summaryDashboard){dashboard=b.dataset.summaryDashboard;primary();}
      if(b.dataset.summaryPerformance){performance=b.dataset.summaryPerformance;primary();}
    });
    return pane;
  }
  window.JGICourseLessonSummary=Object.freeze({build,mount});
})();
