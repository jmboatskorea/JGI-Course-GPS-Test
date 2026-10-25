#!/usr/bin/env python3
"""Single-round cumulative-UI reuse checks. Local Chromium, synthetic records, no external/API traffic.
Run: PYTHONDONTWRITEBYTECODE=1 python tests/course-lesson-summary.test.py --out /tmp/jgi-summary-tests
"""
import argparse,functools,http.server,importlib.util,json,subprocess,threading
from pathlib import Path
spec=importlib.util.spec_from_file_location('reports',Path(__file__).with_name('course-lesson-report.test.py'))
reports=importlib.util.module_from_spec(spec);spec.loader.exec_module(reports);ui=reports.ui
CHECKS=r"""({player,originalRenderer})=>{
 const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+': '+JSON.stringify([a,b]));};
 const ok=(value,label)=>{if(!value)throw Error(label);};const clone=x=>JSON.parse(JSON.stringify(x));
 const globalBefore=JSON.stringify(round),storageBefore=JSON.stringify({...localStorage}),before=JSON.stringify(player);
 let p=clone(player),x=JGICourseLessonSummary.build(p),h=x.round.holes[0];
 same(x.score,6,'score 3+2+1');same(x.toPar,2,'to par');same(x.puttCount,2,'putts');same(x.penalties,1,'penalty');same(x.handicap,player.profile.handicap,'registered handicap');
 same(x.view.sgValues,JGICourseLessonReport.build(p).sgValues,'same SG adapter');
 const expected=multiCorePerformanceRates([x.round]);same(x.core,expected,'existing core criteria for full known data');
 same(x.puttGroups['5~8m'].short,1,'8m SHORT bucket');same(x.puttGroups['0~1m'].holed,1,'1m HOLED bucket');
 // An unfinished hole cannot enter the completed-hole score, putts, penalties or SG.
 p.round.holes[1]={...clone(p.round.holes[0]),hole:2,completed:false,penalties:9};x=JGICourseLessonSummary.build(p);
 same([x.score,x.puttCount,x.penalties],[6,2,1],'unfinished hole excluded');same(x.view.sgValues,JGICourseLessonSummary.build(player).view.sgValues,'unfinished SG excluded');
 p=clone(player);p.profile.handicap=7.3;p.round.playerHandicap=19;x=JGICourseLessonSummary.build(p);same(x.handicap,7.3,'HCP is profile, not performance or SG handicap');
 p=clone(player);p.round.holes[0].shots[0].end=null;p.round.holes[0].shots[0].endLie='UNKNOWN';p.round.holes[0].shots[1].end=null;p.round.holes[0].shots[1].endLie='UNKNOWN';x=JGICourseLessonSummary.build(p);
 same(x.core.FAIRWAY.rate,null,'unknown fairway not counted as miss');same(x.core.GIR.rate,null,'unknown regulation ends not counted as missed GIR');same(x.core.RECOVERY.rate,null,'unknown GIR cannot establish Recovery');same(x.view.sgValues.sgTotal,null,'missing SG total not zero');
 p=clone(player);h=p.round.holes[0];h.shots[0].startLie='UNKNOWN';h.shots[0].start={lat:20,lng:20};x=JGICourseLessonSummary.build(p);same(x.core.BUNKER_SAVE.rate,null,'unknown start can conceal a bunker opportunity');ok(x.core.BUNKER_SAVE.insufficient,'bunker insufficiency explicit');
 p=clone(player);p.round.holes[1]={...clone(p.round.holes[0]),hole:2};p.round.holes[1].shots[0].end=null;p.round.holes[1].shots[0].endLie='UNKNOWN';x=JGICourseLessonSummary.build(p);same(x.core.FAIRWAY.rate,null,'partial known sample is not a full round Fairway rate');
 // Existing 2-stroke save and regulation criteria, including a genuine recovery opportunity.
 p=clone(player);h=p.round.holes[0];h.penalties=0;h.penaltyEvents=[];h.puttsDetail=[{distanceM:1,result:'HOLED',number:1}];h.putts=1;
 h.shots[2].courseContext.distanceToGreenEdgeM=20;x=JGICourseLessonSummary.build(p);same(x.core.GIR.rate,0,'third shot on par4 is missed GIR');same(x.core.RECOVERY.rate,100,'score4 recovery');same(x.core.BUNKER_SAVE.rate,100,'bunker shot + 1 putt save');
 // Legacy rendering of the cumulative report remains byte-for-byte identical without a Lesson context.
 const original=(0,eval)('('+originalRenderer+')');same(multiShotHoleDetailHtml(player.round,player.round.holes[0],true),original(player.round,player.round.holes[0],true),'cumulative renderer unchanged');
 // All 18 completed holes use final labels/sums; no player or archive aggregation.
 p=clone(player);p.round.holes=Array.from({length:18},(_,i)=>({...clone(player.round.holes[0]),hole:i+1}));x=JGICourseLessonSummary.build(p);same([x.score,x.toPar,x.puttCount,x.full.complete],[108,36,36,true],'final18');
 same(JSON.stringify(player),before,'raw shot/putt/penalty/edit history unchanged');same(JSON.stringify(round),globalBefore,'personal global unchanged');same(JSON.stringify({...localStorage}),storageBefore,'storage unchanged');
 return {checks:'single-round score/HCP/SG/core/putts/penalties/unknown/partial/final18/immutability/legacy-renderer PASS',final:p};
}"""
STYLES=r"""prefix=>{
 const root=document.querySelector(prefix),pick=selector=>{const e=root.querySelector(selector),s=getComputedStyle(e);return Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderRadius','borderColor','borderWidth','padding','letterSpacing'].map(k=>[k,s[k]]));};
 return {hero:pick('.multiHero'),card:pick('.resultsMetric'),value:pick('.resultsMetric b'),label:pick('.resultsMetric span'),core:pick('.multiCoreRateCard'),gap:getComputedStyle(root.querySelector('.multiCockpitSummary')).gap};
}"""
def original_markup(page):
 return page.locator('#resultsMultiView').evaluate("el=>{const c=el.cloneNode(true);c.querySelectorAll('[style=\"\"]').forEach(n=>n.removeAttribute('style'));return c.innerHTML;}")
def open_summary(page):
 page.locator('#lessonReportOpen').click();page.locator('[data-report-tab="summaryScreen"]').click();ui.expect(page.locator('#lessonReport-summaryScreen')).to_be_visible()
def value(page,name):return page.locator('[data-summary-metric="'+name+'"] b')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-summary-tests');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 repo=ui.REPO;source=(repo/'course-lesson.js').read_text();old=subprocess.check_output(['git','show','aafafd3:index.html'],cwd=repo,text=True)
 baseline=old[old.index('function shotStartDistanceToHoleM('):old.index('function formatSg(')];renderer=old[old.index('function multiShotHoleDetailHtml('):old.index('\nfunction multiShotRoundDetailHtml(')]
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(repo)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);url=base+'/?courseLessonDev=1'
 result={'environment':'Cloud Chromium, synthetic fixtures, external/API blocked; not physical Safari/iPad/iPhone','baseline':'aafafd3','runs':[]}
 try:
  with ui.sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   for width,height,label in [(390,844,'iphone'),(820,1180,'ipad'),(844,390,'iphone-landscape'),(1180,820,'ipad-landscape'),(320,740,'narrow')]:
    context=browser.new_context(viewport={'width':width,'height':height});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base));page=context.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    ui.fixture(page,source,url,'empty');calc=page.evaluate(reports.CALCULATIONS,{'baseline':baseline});checks=page.evaluate(CHECKS,{'player':calc['knownPlayer'],'originalRenderer':renderer});g=page.evaluate(reports.ENGINE_FIXTURE,{'source':source,'points':calc['points']});page.reload(wait_until='domcontentloaded')
    before=ui.storage_group(page);comparison_round=page.evaluate('()=>JGICourseLessonSummary.build(JSON.parse(localStorage.getItem("jgi_course_lesson_group_v1")).players[0]).round');personal=ui.personal_storage(page);global_before=page.evaluate('JSON.stringify(round)');original_dom=original_markup(page);css_before=page.evaluate('()=>[...document.styleSheets].find(s=>s.href?.includes("cumulative-report.css")).cssRules.length')
    open_summary(page);ui.expect(value(page,'score')).to_have_text('6');ui.expect(value(page,'putts')).to_have_text('2');ui.expect(value(page,'hcp')).to_have_text('5.0');ui.expect(page.locator('#lessonSummary-multiReviewSub')).to_contain_text('진행 중');ui.expect(page.locator('[data-summary-metric="score"] span')).to_have_text('CURRENT SCORE')
    summary=page.locator('#lessonReport-summaryScreen');text=summary.inner_text();assert not any(x in text for x in ['멘탈','MENTAL','Player State','누적','라운드 평균','Avg','최근 3R','Performance HCP'])
    expected=page.evaluate('()=>JGICourseLessonSummary.build(JSON.parse(localStorage.getItem("jgi_course_lesson_group_v1")).players[0]).view.sgValues')
    for cat,key in [('ott','sgOtt'),('app','sgApp'),('arg','sgArg'),('putt','sgPutt'),('total','sgTotal')]:ui.expect(page.locator('[data-summary-sg="'+cat+'"] b')).to_have_text('미계산' if expected[key] is None else page.evaluate('x=>multiSigned(x)',expected[key]))
    geometry=page.locator('#lessonReport-summaryScreen .multiCockpitSummary').evaluate('el=>[...el.querySelectorAll(".resultsMetric")].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})')
    assert abs(geometry[0]['y']-geometry[1]['y'])<1 and abs(geometry[2]['y']-geometry[3]['y'])<1 and geometry[2]['y']>geometry[0]['y'],geometry
    assert page.locator('.lessonReportDialog').evaluate('el=>el.scrollWidth<=el.clientWidth+1'),'horizontal overflow'
    page.screenshot(path=str(out/f'lesson-summary-{label}.png'));styles=page.evaluate(STYLES,'#lessonReport-summaryScreen')
    # Nested analysis buttons are scoped to this report, including repeated transitions.
    for mode in ['CLUB','COURSE','PERFORMANCE','CLUB','PERFORMANCE']:
     page.locator('[data-summary-dashboard="'+mode+'"]').click()
    for mode in ['BALL','SHORT_GAME','PUTTING','SG','SCORING']:
     page.locator('[data-summary-performance="'+mode+'"]').click();ui.expect(page.locator('#lessonSummary-multiPrimaryDetail')).to_be_visible()
     if mode=='PUTTING':page.screenshot(path=str(out/f'lesson-putting-analysis-{label}.png'))
    page.locator('[data-report-tab="performanceScreen"]').click();ui.expect(page.locator('#lessonReport-performanceScreen')).to_be_visible();page.locator('[data-report-tab="summaryScreen"]').click();ui.expect(summary).to_be_visible();page.locator('[data-report-close]').click()
    assert ui.storage_group(page)==before;ui.assert_personal(page,personal);assert page.evaluate('JSON.stringify(round)')==global_before;assert original_markup(page)==original_dom;assert page.evaluate('()=>[...document.styleSheets].find(s=>s.href?.includes("cumulative-report.css")).cssRules.length')==css_before
    # B uses only B's score, putts, penalty and registered HCP.
    page.locator('#lessonPlayers .lessonPlayer').nth(1).click();open_summary(page);ui.expect(value(page,'score')).to_have_text('3');ui.expect(value(page,'putts')).to_have_text('0');ui.expect(value(page,'hcp')).to_have_text('6.0');assert 'TEST 선수 A' not in summary.inner_text();page.locator('[data-report-close]').click()
    page.reload(wait_until='domcontentloaded');open_summary(page);ui.expect(value(page,'score')).to_have_text('3');page.locator('[data-report-close]').click();context.set_offline(True);open_summary(page);ui.expect(value(page,'score')).to_have_text('3');page.locator('[data-report-close]').click();context.set_offline(False)
    # No-record player never displays zero SG; there are no empty Mental cards/tabs.
    page.locator('#lessonPlayers .lessonPlayer').nth(2).click();open_summary(page);ui.expect(page.locator('[data-summary-sg="total"] b')).to_have_text('미계산');ui.expect(page.locator('[data-summary-core="FAIRWAY"] b')).to_have_text('데이터 부족');page.locator('[data-report-close]').click()
    # All 18 completed holes display FINAL SCORE. This synthetic render fixture is never saved.
    page.evaluate('p=>JGICourseLessonReport.open(p)',checks['final']);page.locator('[data-report-tab="summaryScreen"]').click();ui.expect(value(page,'score')).to_have_text('108');ui.expect(page.locator('[data-summary-metric="score"] span')).to_have_text('FINAL SCORE');ui.expect(page.locator('#lessonSummary-multiReviewSub')).to_contain_text('18홀 완료');page.locator('[data-report-close]').click()
    # Compare to the actual existing cumulative renderer on a separate personal ROUND page.
    reference=context.new_page();reference.on('pageerror',lambda e:errors.append(str(e)));reference.on('dialog',lambda d:d.accept());reference.goto(base+'/',wait_until='domcontentloaded');reference.locator('#enterResultsBtn').click();reference.evaluate('p=>{round=p.round;renderMultiRoundReview([p.round]);window.scrollTo({top:0,behavior:"instant"});}',{'round':comparison_round});ui.expect(reference.locator('#introScreen')).not_to_be_visible();ui.expect(reference.locator('#multiReviewTitle')).to_be_in_viewport();ui.expect(reference.locator('#resultsMultiView')).to_be_visible();reference.screenshot(path=str(out/f'original-cumulative-{label}.png'));
    for i,key in enumerate(['sgOtt','sgApp','sgArg','sgPutt']):ui.expect(reference.locator('#multiPlayerSgCards .multiPlayerSgCard b').nth(i)).to_have_text('—' if expected[key] is None else reference.evaluate('x=>multiSigned(x)',expected[key]))
    reference_styles=reference.evaluate(STYLES,'#resultsMultiView');assert styles==reference_styles,(styles,reference_styles)
    assert '멘탈 분석' in reference.locator('#resultsMultiView').inner_text();assert reference.locator('#multiRangeTabs').count()==1
    assert not errors,errors
    result['runs'].append({'viewport':[width,height],'calculations':checks['checks'],'topCards2x2':True,'originalCumulativeStylesIdentical':True,'AB_isolation_refresh_offline_raw_personal_unchanged':True,'mentalExcludedLesson_preservedRound':True,'styles':styles});context.close()
   browser.close()
  result['status']='PASS'
 except Exception as error:result['status']='FAIL';result['error']=str(error);raise
 finally:(out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));server.shutdown()
 print(json.dumps({'status':result['status'],'out':str(out),'viewports':len(result['runs'])},ensure_ascii=False))
if __name__=='__main__':main()
