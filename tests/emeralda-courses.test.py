#!/usr/bin/env python3
"""Emeralda ordered nines: local browser, synthetic records, simulated existing Satellite Map."""
import argparse,functools,hashlib,http.server,importlib.util,json,threading
from pathlib import Path
from urllib.parse import urlparse

def load(name,file):
    s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

ui=load('em_ui','course-lesson-ui.test.py');maps=load('em_maps','course-lesson-map.test.py');courses=load('em_courses','course-lesson-course.test.py');private=load('em_private','course-lesson-private-ui.test.py')
CLUB='Emeralda Golf Club';NINES=['River','Lake','Plantation'];PAIRS=[(a,b) for a in NINES for b in NINES if a!=b]
FROZEN={}

def gate(route,base):
    path=urlparse(route.request.url).path;name='index.html' if path in ['/','/index.html'] else path.removeprefix('/')
    if route.request.url.startswith(base+'/') and name in FROZEN:
        route.fulfill(status=200,content_type='text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'text/javascript',body=FROZEN[name])
    else:ui.gate(route,base)
CHECK=r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1'));
 for(const p of g.players){const r=p.round;if(!r)continue;const d=activeCourseData(r),card=activeCourseScorecard(r);
  if(d.courseId!==null||d.courseIds.length!==2||r.holes.length!==18)throw Error('Composite source identity');
  for(const h of r.holes){const s=d.holes[h.hole],c=card.holes[h.hole];if(h.sourceCourseId!==s.sourceCourseId||h.sourceNine!==s.sourceNine||h.sourceHoleNumber!==s.sourceHoleNumber||h.sourceHoleId!==s.i)throw Error('Stored source mapping');
   if(h.par!==c.par||h.teeDistanceM!==(c[r.tee]??null)||h.strokeIndexMen!==null||h.strokeIndexLadies!==null)throw Error('Scorecard null/source preservation');
  }
 }return true;
}"""
EXPECTED=r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),p=g.players.find(p=>p.playerId===g.selectedPlayerId),r=p.round,n=r.currentHole,[front,back]=r.nine.split(' / '),name=n<=9?front:back,local=(n-1)%9+1,entry=JGI_EMERALDA_NINES.find(e=>e.data.nine===name),raw=entry.data.holes[local],actual=activeCourseData(r).holes[n];
 if(actual.i!==raw.i||JSON.stringify(actual.t)!==JSON.stringify(raw.t)||JSON.stringify(actual.g)!==JSON.stringify(raw.g))throw Error('Source GPS mixed');
 return {id:raw.i,courseId:entry.data.courseId,sourceNine:name,sourceHoleNumber:local,tee:raw.t};
}"""

def choice(page,prefix,front,back):
    page.locator('#'+prefix+'FrontNine').select_option(front)
    options=page.locator('#'+prefix+'BackNine option').all_text_contents();assert len(options)==2 and front not in options,options
    page.locator('#'+prefix+'BackNine').select_option(back)
    ui.expect(page.locator('#'+('lessonCourseNine' if prefix=='lesson' else 'courseNine'))).to_have_value(front+' / '+back)

def setup_pairs(page,prefix):
    for front,back in PAIRS:choice(page,prefix,front,back)

def round_flow(page,base):
    result=[]
    for front,back in PAIRS:
        page.goto(base+'/',wait_until='domcontentloaded');page.locator('#enterRoundBtn').click();ui.expect(page.locator('#setupScreen')).to_be_visible()
        page.locator('#courseSelect').select_option(CLUB);ui.expect(page.locator('#setupEmeraldaNines')).to_be_visible();ui.expect(page.locator('#courseNine')).not_to_be_visible();choice(page,'course',front,back)
        page.locator('#startRoundBtn').click()
        if page.locator('#conditionScreen').is_visible():page.locator('#whoopStartRound').click()
        ui.expect(page.locator('#roundScreen')).to_be_visible()
        data=page.evaluate('''()=>({course:round.course,nine:round.nine,holes:round.holes.length,front:round.holes[0].sourceNine,back:round.holes[9].sourceNine,storage:JSON.parse(localStorage.getItem('agi_player_v1_round')).nine})''')
        assert data=={'course':CLUB,'nine':front+' / '+back,'holes':18,'front':front,'back':back,'storage':front+' / '+back},data
        result.append(data)
    check=page.evaluate('''()=>{const legacy={course:'Emeralda Golf Club',nine:'Lake',holes:[{hole:10,shots:[{id:'TEST_KEEP'}]}]},before=JSON.stringify(legacy);if(activeCourseData(legacy)!==null||activeCourseScorecard(legacy)!==null||JGIEmeraldaCourses.sourceHole(legacy,10)!==null||JSON.stringify(legacy)!==before)throw Error('Legacy Lake fabricated/fallback');return [['Jagorawi Golf & Country Club','Old Course',22987],['Ora Country Club','South Left',34617],['Gunung Geulis','East Course',22984],['Gunung Geulis','West Course',22983]].map(([course,nine,id])=>{if(activeCourseData({course,nine}).courseId!==id)throw Error('Existing course fallback');return id;});}''')
    page.goto(base+'/',wait_until='domcontentloaded');page.locator('#enterRoundBtn').click();page.locator('#courseSelect').select_option('Ora Country Club');ui.expect(page.locator('#setupEmeraldaNines')).not_to_be_visible();ui.expect(page.locator('#courseNine')).to_have_value('South Left')
    return {'actual_round_starts':result,'existing_course_ids':check,'legacy_bare_Lake':'null/unmodified PASS'}

def stage(page):
    expected=page.evaluate(EXPECTED);ui.main_map_click(page,{'lat':expected['tee'][0],'lng':expected['tee'][1]});ui.click(page,'#lessonConfirmPosition');ui.click(page,'#lessonShotSave');return expected

def register(page,count):
    g=ui.storage_group(page)
    for i,p in enumerate(g['players']):
        page.locator('#lessonManagePlayer').select_option(p['playerId']);page.locator('#lessonName').fill('TEST Emeralda '+chr(65+i));page.locator('#lessonContact').fill('');page.locator('#lessonSex').select_option('FEMALE' if i%2==0 else 'MALE');page.locator('#lessonHandicap').fill(str(5+i));page.locator('#lessonTee').select_option(['Red','Blue','White','Blue'][i]);ui.click(page,'#lessonRegisterPlayer')
    ui.click(page,'#lessonManageClose');assert page.evaluate(CHECK)

def lesson_flow(page,base,front,back,count,out,label):
    page.goto(base+'/',wait_until='domcontentloaded');page.evaluate("()=>{const r=emptyRound('Jagorawi Golf & Country Club','Old Course');r.playerName='TEST PERSONAL SENTINEL';localStorage.setItem('agi_player_v1_round',JSON.stringify(r));localStorage.setItem('jgi_completed_rounds_v1','[]');}");page.reload(wait_until='domcontentloaded');personal=ui.personal_storage(page)
    page.locator('#enterCourseLessonBtn').click();page.wait_for_selector('#lessonCourseSelect',state='attached');ui.reveal(page,'#lessonCourseSelect').select_option(CLUB);ui.expect(page.locator('#lessonEmeraldaNines')).to_be_visible();ui.expect(page.locator('#lessonCourseNine')).not_to_be_visible();setup_pairs(page,'lesson');choice(page,'lesson',front,back);page.locator('#lessonPlayerCount').select_option(str(count));ui.click(page,'#lessonCreateGroup');register(page,count);g=ui.storage_group(page)
    assert g['nine']==front+' / '+back and all(p['round']['nine']==g['nine'] for p in g['players']);page.evaluate(maps.FAKE,'VECTOR');maps.frames(page);ids=[]
    for n in range(1,19):
        page.locator('#lessonHole').select_option(str(n));maps.frames(page);expected=page.evaluate(EXPECTED);assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id')==str(expected['id']);shape=page.evaluate(maps.GEOMETRY);assert shape['tee']['y']>shape['green']['y'];ui.click(page,'#lessonSatellite');maps.frames(page);maps.camera_fits(page);ui.click(page,'#lessonJgiMap');ids.append(expected['id'])
    page.locator('#lessonHole').select_option('1');maps.frames(page);points=page.evaluate(courses.POINTS)
    for i in range(count):ui.select_player(page,g,i);stage(page)
    ui.select_player(page,g,0);private.penalty(page,'OB',1);private.green(page,points['green']);ui.reveal(page,'#lessonPuttDistanceInput').fill('8');ui.click(page,'#lessonPuttShort');ui.reveal(page,'#lessonPuttDistanceInput').fill('1');ui.click(page,'#lessonPuttHoled');a=ui.storage_group(page)['players'][0]['round']['holes'][0]
    ui.select_player(page,g,1);private.penalty(page,'HAZARD',2);private.green(page,points['green']);ui.reveal(page,'#lessonPuttDistanceInput').fill('3');ui.click(page,'#lessonPuttLong');ui.reveal(page,'#lessonPuttDistanceInput').fill('1');ui.click(page,'#lessonPuttHoled')
    for i in range(2,count):ui.select_player(page,g,i);ui.click(page,'#lessonHoled')
    g=ui.storage_group(page);assert all(p['round']['currentHole']==2 for p in g['players']);assert g['players'][0]['round']['holes'][0]==a
    assert [p['round']['holes'][0]['score'] for p in g['players']]==[4,5]+[1]*(count-2)
    assert [p['round']['holes'][0]['putts'] for p in g['players']]==[2,2]+[0]*(count-2)
    # Finish front-nine hole 9 independently; the last player triggers the exact back-nine source.
    for i in range(count):
        ui.select_player(page,g,i);page.locator('#lessonHole').select_option('9');maps.frames(page);stage(page);ui.click(page,'#lessonHoled')
    g=ui.storage_group(page);assert all(p['round']['currentHole']==10 for p in g['players']);assert g['selectedPlayerId']==g['players'][-1]['playerId'];maps.frames(page);expected=stage(page);shot=ui.storage_group(page)['players'][-1]['round']['holes'][9]['shots'][0]
    assert expected['sourceNine']==back and expected['sourceHoleNumber']==1
    for key,value in [('courseId',expected['courseId']),('sourceNine',back),('sourceHoleNumber',1),('sourceHoleId',expected['id'])]:assert shot['courseContext'][key]==value,(key,shot['courseContext'])
    assert page.evaluate(CHECK);saved=ui.storage_group(page);page.context.set_offline(True);ui.click(page,'#lessonSaveGroup');page.context.set_offline(False);saved=ui.storage_group(page);page.reload(wait_until='domcontentloaded');page.wait_for_selector('#lessonPlayers');assert ui.storage_group(page)==saved;page.evaluate(maps.FAKE,'VECTOR');maps.frames(page)
    ui.click(page,'#lessonManageOpen') if not page.locator('#lessonManageDialog').is_visible() else None
    ui.expect(page.locator('#lessonFrontNine')).to_have_value(front);ui.expect(page.locator('#lessonBackNine')).to_have_value(back);ui.click(page,'#lessonManageClose')
    reports=[]
    for i in [0,1]:
        ui.select_player(page,g,i);before=ui.storage_group(page);ui.click(page,'#lessonReportOpen');ui.expect(page.locator('#lessonReportTitle')).to_contain_text('TEST Emeralda '+chr(65+i));ui.expect(page.locator('#lessonReport-overviewCourse')).to_contain_text(front+' / '+back);page.locator('[data-report-tab="performanceScreen"]').click();ui.expect(page.locator('#lessonReport-sgTotal')).to_have_text('미계산');page.locator('[data-report-tab="summaryScreen"]').click();ui.expect(page.locator('[data-summary-metric="score"] b')).to_have_text(str(5+i));page.screenshot(path=str(out/(label+'-report-'+str(i)+'.png')));page.locator('[data-report-close]').click();assert ui.storage_group(page)==before;reports.append('player'+str(i)+' independent score '+str(5+i))
    guard=page.evaluate('''()=>{const before=JSON.stringify({...localStorage}),globalBefore=JSON.stringify(round),g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),p=g.players[0],h=p.round.holes[0],v=JGICourseLessonReport.build(p),s={...h.shots[0],startLie:'TEE'};renderFullMultiAnalysis([p.round]);if(JSON.stringify({...localStorage})!==before||JSON.stringify(round)!==globalBefore)throw Error('Cumulative review mutated original data');return {par:h.par,distance:h.teeDistanceM,sg:computeShotSG(h,s,0,sgBenchmarkInfo(p.round),p.round),total:v.sgValues.sgTotal,putt:v.sgValues.sgPutt,resultScore:resultScore(p.round),resultPar:resultPar(p.round),toPar:resultToPar(p.round),targetReady:JGIEmeraldaCourses.scorecardReady(p.round),cumulativeMissing:document.getElementById('analysisOverall').textContent.includes('미계산')};}''');assert guard['par'] is None and guard['distance'] is None and guard['sg'] is None and guard['total'] is None and guard['putt'] is not None,guard
    assert guard['resultScore']==5 and guard['resultPar'] is None and guard['toPar'] is None and not guard['targetReady'] and guard['cumulativeMissing'],guard
    aggregate=page.evaluate('''()=>{const before=JSON.stringify({...localStorage}),globalBefore=JSON.stringify(round),r=emptyRound('Emeralda Golf Club','Lake / River');r.sgBenchmarkMode='FEMALE_PLAYER';r.playerHandicap=5;const h=r.holes[0];h.completed=true;h.shots=Array.from({length:h.par},(_,i)=>({id:'TEST_PAR_'+i,club:'7I',start:null,end:null,startLie:'UNKNOWN',endLie:'UNKNOWN',sg:null}));h.score=h.par;renderFullMultiAnalysis([r]);const rows=[...document.querySelectorAll('#analysisOverall tr')],value=label=>rows.find(row=>row.children[0]?.textContent===label)?.children[1]?.textContent;const out={par:value('파'),birdie:value('버디 이하'),score:resultScore(r),expected:h.par,toPar:resultToPar(r)};if(JSON.stringify({...localStorage})!==before||JSON.stringify(round)!==globalBefore)throw Error('Aggregate mutated saved data');return out;}''')
    assert aggregate['par']=='1홀' and aggregate['birdie']=='0홀' and aggregate['score']==aggregate['expected'] and aggregate['toPar']==0,aggregate
    # Saved combinations cannot change through new-group setup; ending archives the exact original.
    active=ui.storage_group(page);ui.reveal(page,'#lessonCourseSelect');choice(page,'lesson',back,front);ui.click(page,'#lessonCreateGroup');assert ui.storage_group(page)==active;ui.click(page,'#lessonFinishRound');page.locator('#lessonFinishConfirm').click();assert ui.storage_group(page) is None
    archive=page.evaluate("JSON.parse(localStorage.getItem('jgi_course_lesson_archive_v1')).groups");assert len(archive)==1 and archive[0]['group']==active
    page.reload(wait_until='domcontentloaded');page.wait_for_selector('#lessonArchiveList');page.locator('#lessonArchiveList [data-archive-player="'+active['players'][0]['playerId']+'"]').click();ui.expect(page.locator('#lessonReportStatus')).to_contain_text('중도 종료');ui.expect(page.locator('#lessonReport-overviewCourse')).to_contain_text(front+' / '+back);page.locator('[data-report-close]').click();assert ui.personal_storage(page)==personal
    return {'pair':front+' / '+back,'players':count,'uniqueHoleIds':ids,'reportChecks':reports,'unknownSG':guard,'checks':'HOME/selection/GPS27/SAT/players/putts/penalties/9to10/back-source/report/archive/offline/reload/personal preservation PASS'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-emeralda-courses');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    files=['index.html','course-lesson.js','course-lesson.css','course-lesson-report.js','course-lesson-summary.js','target-score-coach.js','emeralda-courses.js','emeralda-course-data.js'];FROZEN.update({f:(ui.REPO/f).read_bytes() for f in files});hashes={f:hashlib.sha256(v).hexdigest() for f,v in FROZEN.items()};hashes['tests/emeralda-courses.test.py']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();(out/'tested-source-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);result={'environment':'Cloud Chromium; synthetic 2/4-player fixtures; external/API blocked; explicit existing-Map Satellite simulation, not physical Safari/real SDK','runs':[]}
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda r:gate(r,base));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());result['round']=round_flow(page,base);context.close()
            for w,h,label,front,back,count in [(390,844,'iphone','River','Lake',2),(820,1180,'ipad','Plantation','River',4)]:
                context=browser.new_context(viewport={'width':w,'height':h});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda r:gate(r,base));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)));result['runs'].append(lesson_flow(page,base,front,back,count,out,label));assert not errors,errors;print(label+': PASS',flush=True);context.close()
            browser.close()
        assert len(set(i for r in result['runs'] for i in r['uniqueHoleIds']))==27
        assert all(hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest()==v for f,v in hashes.items()),'Sources changed during regression'
        result['status']='PASS';print('PASS')
    finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');server.shutdown()

if __name__=='__main__':main()
