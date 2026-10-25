#!/usr/bin/env python3
"""Local Chromium SG parity, read-only reports, UI and personal ROUND regressions.
Run: python tests/course-lesson-report.test.py --out /tmp/jgi-report-checks
Reuses the local-only server/API blocking from course-lesson-ui.test.py.
"""
import argparse, functools, http.server, importlib.util, json, subprocess, threading
from pathlib import Path
spec=importlib.util.spec_from_file_location('lesson_ui',Path(__file__).with_name('course-lesson-ui.test.py'))
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)

CALCULATIONS=r"""({baseline})=>{
 const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+': '+JSON.stringify([a,b]));};
 const ok=(v,label)=>{if(!v)throw Error(label);};
 const clone=x=>JSON.parse(JSON.stringify(x)),stored=localStorage.getItem('jgi_course_lesson_dev_group_v1'),globalBefore=JSON.stringify(round);
 const g=JSON.parse(stored),p=clone(g.players[0]),base=p.round;
 const reference=new Function('round','sgExpected','sgBenchmarkInfo','sgLieKey','greenPointForHole','activeCourseData','hav',baseline+'\nreturn {summary:sgRoundSummary(),shots:round.holes[0].shots.map((s,i)=>computeShotSG(round.holes[0],s,i,sgBenchmarkInfo())),putts:round.holes[0].puttsDetail.map((p,i)=>computePuttSG(round.holes[0],p,i,sgBenchmarkInfo())),categories:round.holes[0].shots.map((s,i)=>sgShotCategory(round.holes[0],s,i))};');
 const source=activeCourseData(base),ch=source.holes['1'],pos=pair=>({lat:pair[0],lng:pair[1],accuracy:null,source:'MANUAL_DROP'}),start=pos(ch.t),end=pos(ch.g);
 const known=(par=4)=>{
  const player=clone(p),r=player.round,h=r.holes[0];r.currentHole=1;h.par=par;h.teeDistanceM=350;h.completed=true;h.putts=2;h.penalties=1;
  h.penaltyEvents=[{id:'clpen_test',type:'OB',strokes:1,hole:1,at:1}];
  h.puttsDetail=[{distanceM:8,result:'SHORT',number:1},{distanceM:1,result:'HOLED',number:2}];
  h.shots=[['DR','TEE','FAIRWAY',350,160],['7I','FAIRWAY','BUNKER',160,30],['58°','BUNKER','GREEN',30,null]].map(([club,startLie,endLie,before,after],i)=>({id:'test_'+i,club,startLie,endLie,start:clone(start),end:clone(end),distanceM:100,holed:false,sg:null,courseContext:{startGreenDistanceM:before,endGreenDistanceM:after,distanceToGreenEdgeM:i===2?20:100},editHistory:[{type:'KEEP',at:1}]}));
  return player;
 };
 const parity=[];
 for(const [mode,hcps] of [['PLAYER',[0,5.2,18.4,25]],['FEMALE_PLAYER',[0,5.2,18.4,28]]])for(const handicap of hcps){
  const player=known(),r=player.round;r.sgBenchmarkMode=mode;r.playerHandicap=handicap;
  const before=JSON.stringify(player),v=JGICourseLessonReport.build(player),info=sgBenchmarkInfo(r);
  const ref=reference(r,sgExpected,()=>sgBenchmarkInfo(r),sgLieKey,hole=>greenPointForHole(hole,r),()=>activeCourseData(r),hav);
  eq(v.sg,ref.summary,'original ROUND summary '+mode+handicap);
  eq(v.round.holes[0].shots.map((s,i)=>computeShotSG(v.round.holes[0],s,i,info,v.round)),ref.shots,'shot parity');
  eq(v.round.holes[0].puttsDetail.map((p,i)=>computePuttSG(v.round.holes[0],p,i,info)),ref.putts,'putt parity');
  eq(v.records.filter(x=>x.kind==='SHOT').map(x=>x.category),['ott','app','arg'],'OTT APP ARG');
  eq(v.sgValues.sgTotal,v.sg.total,'complete SG');eq(holeScore(v.round.holes[0]),6,'3 shot + 2 putt + 1 penalty');
  eq(v.sg.totals.penalty,-1,'penalty once');eq(v.sg.total,ref.shots.reduce((a,x)=>a+x.value,0)+ref.putts.reduce((a,x)=>a+x.value,0)-1,'total no double deduction');
  eq(ref.putts[0].value,sgExpected(8,'GREEN',info)-sgExpected(1,'GREEN',info)-1,'8m SHORT');eq(ref.putts[1].value,sgExpected(1,'GREEN',info)-1,'1m HOLED');
  eq(JSON.stringify(player),before,'raw/edit history unchanged');eq(v.sg.info,info,'benchmark metadata');
  parity.push({mode,handicap,label:info.label,profileVersion:info.profileVersion||null,total:v.sg.total,putting:v.sg.totals.putt});
 }
 let player=known(3),v=JGICourseLessonReport.build(player);eq(v.records[0].category,'app','PAR3 tee APP');
 player=known();let h=player.round.holes[0];h.shots=h.shots.slice(0,1);h.shots[0].end=null;h.shots[0].endLie='HOLED';h.shots[0].holed=true;h.puttsDetail=[];h.putts=0;h.penalties=0;h.penaltyEvents=[];
 v=JGICourseLessonReport.build(player);eq(v.records[0].value,sgExpected(350,'TEE',v.sg.info)-1,'direct HOLED expected after zero');eq(holeScore(v.round.holes[0]),1,'direct score 1 zero putts');
 player=known();h=player.round.holes[0];h.shots[0].startLie='UNKNOWN';h.shots[0].start={lat:20,lng:20};v=JGICourseLessonReport.build(player);eq(v.records[0].value,null,'UNKNOWN cannot compute');eq(v.sgValues.sgTotal,null,'missing total not zero');
 player=known();h=player.round.holes[0];h.shots[0].start=null;v=JGICourseLessonReport.build(player);eq(v.records[0].value,null,'missing saved position cannot compute');
 player=known();h=player.round.holes[0];h.puttsDetail=[];h.putts=0;h.completed=false;v=JGICourseLessonReport.build(player);eq(v.records[2].value,null,'ON GREEN waits for actual first putt');
 player=known();h=player.round.holes[0];h.puttsDetail=[{distanceM:8,result:'SHORT'}];v=JGICourseLessonReport.build(player);eq(v.records.at(-1).value,null,'SHORT waits for actual next distance');eq(v.sgValues.sgPutt,null,'missing putting not zero');
 player=known();h=player.round.holes[0];h.puttsDetail[0].distanceM=null;v=JGICourseLessonReport.build(player);eq(v.records[2].value,null,'null first putt not zero');eq(v.records[3].value,null,'null distance not zero SG');
 player=known();h=player.round.holes[0];h.shots[2].courseContext.endGreenDistanceM=9999;v=JGICourseLessonReport.build(player);eq(computeShotSG(v.round.holes[0],v.round.holes[0].shots[2],2,v.sg.info,v.round).endDistanceM,8,'actual first putt overrides map estimate without PIN');
 player=known();h=player.round.holes[0];h.shots[1].courseContext.startGreenDistanceM=1000;v=JGICourseLessonReport.build(player);eq(v.records[1].value,null,'female benchmark outside validated range');
 const interior=(type)=>{
  for(const shape of courseShapes(ch,base).filter(s=>s.type===type&&!s.line)){
   const pts=shape.path,minLat=Math.min(...pts.map(p=>p.lat)),maxLat=Math.max(...pts.map(p=>p.lat)),minLng=Math.min(...pts.map(p=>p.lng)),maxLng=Math.max(...pts.map(p=>p.lng));
   for(let y=1;y<20;y++)for(let x=1;x<20;x++){
    const q={lat:minLat+(maxLat-minLat)*y/20,lng:minLng+(maxLng-minLng)*x/20,accuracy:null};
    if(pointInPolygonXY({x:q.lng,y:q.lat},pts.map(p=>({x:p.lng,y:p.lat})))){
     const test=known();test.round.holes[0].shots[0].start=q;test.round.holes[0].shots[0].startLie='UNKNOWN';
     if(JGICourseLessonReport.build(test).round.holes[0].shots[0].startLie===type)return q;
    }
   }
  }throw Error('No reliable interior '+type);
 };
 const teePoint=interior('TEE'),fairwayPoint=interior('FAIRWAY'),bunkerPoint=interior('BUNKER');
 for(const [point,lie] of [[teePoint,'TEE'],[fairwayPoint,'FAIRWAY'],[bunkerPoint,'BUNKER']]){
  player=known();h=player.round.holes[0];h.shots[0].start=point;h.shots[0].startLie='UNKNOWN';v=JGICourseLessonReport.build(player);eq(v.round.holes[0].shots[0].startLie,lie,'actual GI polygon '+lie);eq(h.shots[0].startLie,'UNKNOWN','raw Lie immutable');
 }
 player=known();h=player.round.holes[0];h.shots[0].start={...teePoint,accuracy:1000};h.shots[0].startLie='UNKNOWN';v=JGICourseLessonReport.build(player);eq(v.records[0].value,null,'uncertain GPS not a reliable Lie');
 player=known();h=player.round.holes[0];h.shots[0].start=teePoint;h.shots[0].startLie='UNKNOWN';h.shots[0].courseContext.geometryVersion='DIFFERENT';v=JGICourseLessonReport.build(player);eq(v.records[0].value,null,'geometry mismatch not reliable');
 eq(localStorage.getItem('jgi_course_lesson_dev_group_v1'),stored,'group storage untouched');eq(JSON.stringify(round),globalBefore,'personal global untouched');
 return {parity,checks:'categories/score/penalty/putts/direct hole-out/unknown/null/GI/GPS/version/immutability PASS',points:{teePoint,fairwayPoint,bunkerPoint},knownPlayer:known()};
}"""

ENGINE_FIXTURE=r"""({source,points})=>{
 const E=new Function('module',source+'\nreturn module.exports;')({exports:{}});let g=JSON.parse(localStorage.getItem(E.STORAGE)),seq=100000,clock=1780000000000;
 const geometry=(r,hole)=>{const data=activeCourseData(r),h=data.holes[String(hole)];return {hole,holeId:h.i??h.id??null,courseId:data.courseId??null,geometryVersion:data.version||r.courseVersion,polygons:courseShapes(h,r).filter(s=>s.type==='GREEN'&&!s.line).map(s=>s.path)};};
 const services={uuid:()=>String(++seq),now:()=>++clock,benchmark:r=>sgBenchmarkInfo(r),hydrate:r=>hydrateRoundCourseTruth(r),distance:hav,greenGeometry:geometry,clubs:DEFAULT_MASTER_CLUBS.filter(c=>c.name!=='Putter').map(c=>c.name),shotContext:r=>({geometryVersion:activeCourseData(r).version})};
 const point=p=>({...p,accuracy:null,time:++clock,source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
 const shot=(pid,q,club)=>{g=E.selectPlayer(g,pid);g=E.setShotClub(g,pid,club,services);g=E.recordShot(E.confirmPosition(E.stagePosition(g,pid,point(q)),pid,services),pid,services);};
 const a=g.players[0].playerId,b=g.players[1].playerId;
 shot(a,points.teePoint,'DR');shot(a,points.fairwayPoint,'7I');shot(a,points.bunkerPoint,'58°');
 const geo=geometry(g.players[0].round,1),pts=geo.polygons.flat();let green=null;
 for(const p of pts){const center={lat:pts.reduce((s,q)=>s+q.lat,0)/pts.length,lng:pts.reduce((s,q)=>s+q.lng,0)/pts.length};if(E.pointInGreen(center,geo)){green=point(center);break;}}
 if(!green)throw Error('No actual green interior');
 g=E.onGreen(g,a,g.players[0].round.holes[0].shots.at(-1).id,green,null,services);
 for(const [distance,result] of [['8','SHORT'],['1','HOLED']]){g=E.setPuttDistance(g,a,1,distance,services);const h=g.players[0].round.holes[0];g=E.recordPutt(g,a,1,h.puttsDetail.length+1,h.puttingReady.inputId,result,services);}
 g=E.recordPenalty(g,a,1,'clpen_report_A','OB',1,services);
 shot(b,points.teePoint,'DR');g=E.holed(g,b,g.players[1].round.holes[0].shots[0].id,services);g=E.recordPenalty(g,b,1,'clpen_report_B','HAZARD',2,services);
 g=E.selectPlayer(g,a);E.validateGroup(g);localStorage.setItem(E.STORAGE,JSON.stringify(g));return g;
}"""


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-report-checks');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 repo=ui.REPO;source=(repo/'course-lesson.js').read_text()
 original=subprocess.check_output(['git','show','9bc3e3b:index.html'],cwd=repo,text=True)
 baseline=original[original.index('function shotStartDistanceToHoleM('):original.index('function formatSg(')]
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(repo)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);url=base+'/?courseLessonDev=1'
 results={'environment':'Cloud Chromium, synthetic data, external/API blocked; not physical Safari/iOS','baseline':'9bc3e3b','runs':[]}
 try:
  with ui.sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   for width,height,label in [(390,844,'iphone'),(820,1180,'ipad'),(844,390,'iphone-landscape'),(1180,820,'ipad-landscape'),(320,740,'narrow')]:
    context=browser.new_context(viewport={'width':width,'height':height});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base));page=context.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    ui.fixture(page,source,url,'empty');calc=page.evaluate(CALCULATIONS,{'baseline':baseline})
    g=page.evaluate(ENGINE_FIXTURE,{'source':source,'points':calc['points']});page.reload(wait_until='domcontentloaded');personal=ui.personal_storage(page);global_before=page.evaluate('JSON.stringify(round)');group_before=page.evaluate('(k)=>localStorage.getItem(k)',ui.GROUP_KEY)
    page.locator('#lessonReportOpen').click();ui.expect(page.locator('.lessonReportDialog')).to_be_visible()
    ui.expect(page.locator('#lessonReport-scoreBig')).to_contain_text('6');ui.expect(page.locator('#lessonReport-ovPutts')).to_have_text('2');ui.expect(page.locator('#lessonReport-ovPen')).to_have_text('1')
    ui.expect(page.locator('#lessonReportStatus')).to_contain_text('진행 중');ui.expect(page.locator('#lessonReport-finalRoundReportBody')).to_contain_text('ROUND IN PROGRESS')
    assert not page.locator('.lessonReportDialog').inner_text().__contains__('멘탈');assert page.locator('#ovFlo').count()==1
    assert page.locator('#lessonReport-ovFlo').count()==0;assert 'WHOOP' not in page.locator('.lessonReportDialog').inner_text()
    page.screenshot(path=str(out/f'lesson-overview-{label}.png'))
    page.locator('[data-report-tab="performanceScreen"]').click();expected=page.evaluate('()=>JGICourseLessonReport.build(JSON.parse(localStorage.getItem("jgi_course_lesson_dev_group_v1")).players[0]).sgValues')
    assert expected['sgTotal'] is not None, expected
    for key,value in expected.items():
     ui.expect(page.locator('#lessonReport-'+key)).to_have_text('미계산' if value is None else page.evaluate('v=>formatSg(v)',value))
    ui.expect(page.locator('#lessonReport-statPutts')).to_have_text('2');ui.expect(page.locator('#lessonReport-statPen')).to_have_text('1')
    page.screenshot(path=str(out/f'lesson-performance-{label}.png'))
    page.locator('[data-performance-view="DISTANCE"]').click();ui.expect(page.locator('.lessonReportDialog .perfHeat')).to_be_visible();page.locator('[data-performance-distance]').first.click()
    page.locator('[data-performance-view="CLUB"]').click();page.locator('[data-performance-club]').first.click()
    overflow=page.locator('.lessonReportDialog').evaluate('el=>el.scrollWidth<=el.clientWidth+1');assert overflow, 'report horizontal overflow'
    page.locator('[data-report-close]').click();assert ui.storage_group(page)==g;assert page.evaluate('(k)=>localStorage.getItem(k)',ui.GROUP_KEY)==group_before
    assert page.evaluate('JSON.stringify(round)')==global_before;ui.assert_personal(page,personal)
    page.locator('#lessonPlayers .lessonPlayer').nth(1).click();b_before=ui.storage_group(page);page.locator('#lessonReportOpen').click();ui.expect(page.locator('#lessonReportTitle')).to_have_text('TEST 선수 B · REPORT');ui.expect(page.locator('#lessonReport-scoreBig')).to_contain_text('3');ui.expect(page.locator('#lessonReport-ovPutts')).to_have_text('0');assert 'TEST 선수 A' not in page.locator('.lessonReportDialog').inner_text();page.locator('[data-report-close]').click();assert ui.storage_group(page)==b_before
    page.reload(wait_until='domcontentloaded');page.locator('#lessonReportOpen').click();ui.expect(page.locator('#lessonReportTitle')).to_have_text('TEST 선수 B · REPORT');page.locator('[data-report-close]').click()
    context.set_offline(True);page.locator('#lessonReportOpen').click();ui.expect(page.locator('#lessonReport-scoreBig')).to_contain_text('3');page.locator('[data-report-close]').click();context.set_offline(False)
    # Partial/missing data must stay missing, including an entirely empty player's SG.
    page.locator('#lessonPlayers .lessonPlayer').nth(2).click();page.locator('#lessonReportOpen').click();page.locator('[data-report-tab="performanceScreen"]').click();ui.expect(page.locator('#lessonReport-sgTotal')).to_have_text('미계산');page.locator('[data-report-close]').click()
    # A complete report is determined by all 18 completed holes, not the selected current hole.
    final=calc['knownPlayer'];final['round']['holes']=[{**final['round']['holes'][0],'hole':i+1} for i in range(18)]
    page.evaluate('p=>JGICourseLessonReport.open(p)',final);page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');assert page.locator('.lessonReportDialog').count()==1;ui.expect(page.locator('#lessonReportStatus')).to_contain_text('18홀 완료');ui.expect(page.locator('#lessonReport-finalRoundReportBody')).to_contain_text('FINAL ROUND REPORT');page.locator('[data-report-close]').click()
    # Report closure preserves an expanded putting panel and its in-progress human distance.
    data,_=ui.fixture(page,source,url,'mixed');ui.select_player(page,data['group'],1);ui.open_putting(page,'TEST 선수 B');ui.reveal(page,'#lessonPuttDistanceInput').fill('7.5');page.locator('#lessonPuttDistanceInput').press('Tab');draft_before=ui.storage_group(page);page.locator('#lessonReportOpen').click();page.locator('[data-report-close]').click();assert ui.storage_group(page)==draft_before;ui.expect(page.locator('#lessonPutting')).to_be_visible();ui.expect(page.locator('#lessonPuttDistanceInput')).to_have_value('7.5')
    # Reuse comparison: personal and Lesson use the same metric classes, colors, borders and fonts.
    page.evaluate('p=>JGICourseLessonReport.open(p)',calc['knownPlayer']);page.locator('[data-report-tab="performanceScreen"]').click()
    styles=page.evaluate("""()=>['scoreBig','sgTotal','sgOtt','statFir'].map(id=>{const s=getComputedStyle(document.getElementById('lessonReport-'+id));return {id,font:s.fontFamily,size:s.fontSize,color:s.color,border:s.borderRadius};})""")
    page.locator('[data-report-close]').click()
    # A separate personal ROUND page avoids moving the Lesson's shared map for the comparison.
    personal_page=context.new_page();personal_page.on('pageerror',lambda e:errors.append(str(e)));personal_page.on('dialog',lambda d:d.accept());personal_page.goto(base+'/',wait_until='domcontentloaded')
    personal_page.evaluate('p=>{round=p.round;round.completedAt=Date.now();showScreen("overview");}',calc['knownPlayer'])
    assert personal_page.locator('#ovFlo').count()==1;assert personal_page.locator('#floScreen').count()==1;assert '멘탈 상태 분석' in personal_page.locator('#liveCategoryCards').inner_text();personal_page.screenshot(path=str(out/f'round-overview-{label}.png'));personal_page.evaluate('showScreen("performance")');personal_page.screenshot(path=str(out/f'round-performance-{label}.png'))
    round_styles=personal_page.evaluate("""()=>['scoreBig','sgTotal','sgOtt','statFir'].map(id=>{const s=getComputedStyle(document.getElementById(id));return {id,font:s.fontFamily,size:s.fontSize,color:s.color,border:s.borderRadius};})""")
    assert styles==round_styles, (styles,round_styles)
    assert not errors,errors
    results['runs'].append({'viewport':[width,height],'sg':calc['parity'],'checks':calc['checks'],'UI':'score/player isolation/read-only/refresh/offline/partial/final/mental absence & Round presence/heatmap PASS','originalMetricStyles':styles});context.close()
   browser.close()
  results['status']='PASS'
 except Exception as e:
  results['status']='FAIL';results['error']=str(e);raise
 finally:
  (out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));server.shutdown()
 print(json.dumps({'status':results['status'],'out':str(out),'viewports':len(results['runs']),'benchmarkParityCasesPerViewport':8},ensure_ascii=False))

if __name__=='__main__':main()
