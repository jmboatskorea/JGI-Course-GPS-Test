#!/usr/bin/env python3
"""Private local-file test. Provider data is supplied outside the repo; never a committed fixture."""
import argparse,functools,hashlib,http.server,importlib.util,json,threading,zipfile
from pathlib import Path

def load(name, filename):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
ui=load('ui','course-lesson-ui.test.py');maps=load('maps','course-lesson-map.test.py');courses=load('courses','course-lesson-course.test.py')
KEY='jgi_course_lesson_private_courses_v1'

def cache_version_flow(page,text):
    return page.evaluate('''async text=>{
      const P=JGICourseLessonPrivate,r={course:'Gunung Geulis',nine:'East Course'};
      await P.importText(text,{storage:localStorage,rights:true});
      const h1=P.data(r).holes['1'],v1=P.data(r).version,a=buildCourseIntelligenceModel(h1,4,r);
      await P.importText(text+' ',{storage:localStorage,rights:true});
      const h2=P.data(r).holes['1'],v2=P.data(r).version,b=buildCourseIntelligenceModel(h2,4,r);
      if(!a||!b||a===b||v1===v2)throw Error('Private geometry cache did not respect file version');
      await P.importText(text,{storage:localStorage,rights:true});
      if(buildCourseIntelligenceModel(P.data(r).holes['1'],4,r)!==a)throw Error('Original file cache was not preserved');
      return 'PASS: private file versions use separate derived geometry caches';
    }''',text)

def verify_original(bundle, archive):
    types={'FairwayTrace':'F','WaterPath':'P','HoleBoundry':'H','WaterTrace':'W','BunkerTrace':'B','TeeboxTrace':'T','GreenTrace':'G'}
    point=lambda p:[p['latitude'],p['longitude']]
    unresolved=0;ids=set()
    with zipfile.ZipFile(archive) as z:
        for entry,side,cid in zip(bundle['courses'],['east','west'],[22984,22983]):
            raw=json.loads(z.read('Gunung-Geulis-36H/'+side+'-gps.json'))
            mapping=json.loads(z.read('Gunung-Geulis-36H/'+side+'-verified-mapping.json'))
            score=json.loads(z.read('Gunung-Geulis-36H/'+side+'-scorecard.json'))
            assert entry['data']['courseId']==cid and len(mapping)==18
            for m in mapping:
                n,hid=m['holeNumber'],m['holeId'];h=entry['data']['holes'][str(n)]
                assert hid not in ids;ids.add(hid)
                original=next(x for x in raw['holes'] if x['holeId']==hid)
                assert h['i']==hid and h['holeId']==hid
                assert h['t']==point(original['teeGPSCoordinate'])==point(m['teeGPSCoordinate'])
                assert h['g']==point(original['greenGPSCoordinate'])==point(m['greenGPSCoordinate'])
                shapes=[[types[g['gpsType']],int(types[g['gpsType']]=='P'),[point(p) for p in shape]] for g in raw['gpsItems'] if g['holeId']==hid for shape in g['shapes']]
                assert h['s']==shapes  # Includes original duplicate shapes; no nearest-hole assignment.
                s=next(x for x in score['holes'] if x['holeNumber']==n);card=entry['scorecard']['holes'][str(n)]
                assert card['par']==s['values']['par']
                for field in ['black','blue','white','red']:assert card[field.title()]==s['values'].get(field)
                assert card['indexMen']==card['indexLadies']==s['values']['handicap']
                unresolved+=len(s['unresolvedFields'])
    assert len(ids)==36 and unresolved==35
    return {'exact_original_mapping_holes':36,'exact_original_GPS_shapes':True,'original_duplicates_preserved':True,'null_conflicts':35}

def import_file(page,path,cache=True):
    ui.reveal(page,'#lessonPrivateFile').set_input_files(str(path))
    page.locator('#lessonPrivateRights').check()
    page.locator('#lessonPrivateCache').set_checked(cache)
    page.locator('#lessonPrivateImport').click()
    ui.expect(page.locator('#lessonPrivateStatus')).to_contain_text('각 18홀 준비')

def green(page,point):
    ui.click(page,'#lessonOnGreen')
    page.evaluate('p=>__cameraMap.emit("click",{latLng:{lat:()=>p.lat,lng:()=>p.lng}})',point)
    ui.click(page,'#lessonGreenSkipPin');ui.click(page,'#lessonGreenSave')

def penalty(page,kind,count):
    ui.click(page,'#lessonPenaltyOpen');page.locator('#lessonPenaltyTypeChoice [data-v="'+kind+'"]').click()
    for _ in range(count-1):page.locator('#lessonPenaltyPlus').click()
    page.locator('#lessonSavePenaltyBtn').click()

def flow(page,base,path,entry,count,out,label):
    page.goto(base+'/',wait_until='domcontentloaded')
    ui.expect(page.locator('#enterCourseLessonBtn')).to_be_enabled();page.locator('#enterCourseLessonBtn').click()
    page.wait_for_selector('#lessonPrivateFile',state='attached')
    personal=ui.personal_storage(page)
    import_file(page,path)
    page.locator('#lessonCourseSelect').select_option('Gunung Geulis')
    assert page.locator('#lessonCourseNine option').all_text_contents()==['East Course','West Course']
    page.locator('#lessonCourseNine').select_option(entry['data']['nine'])
    page.locator('#lessonPlayerCount').select_option(str(count));ui.click(page,'#lessonCreateGroup')
    g=ui.storage_group(page)
    for i,p in enumerate(g['players']):
        page.locator('#lessonManagePlayer').select_option(p['playerId'])
        page.locator('#lessonName').fill('TEST Private '+chr(65+i));page.locator('#lessonContact').fill('')
        page.locator('#lessonSex').select_option('FEMALE' if i%2==0 else 'MALE')
        page.locator('#lessonHandicap').fill(str(i+5));page.locator('#lessonTee').select_option(['Blue','Red','White','Blue'][i])
        ui.click(page,'#lessonRegisterPlayer')
    g=ui.storage_group(page);ui.select_player(page,g,0)
    if page.locator('#lessonManageDialog').is_visible():ui.click(page,'#lessonManageClose')
    expected_version='PRIVATE_GI_'+hashlib.sha256(path.read_bytes()).hexdigest()
    assert all(p['round']['courseVersion']==expected_version for p in g['players'])
    for p in g['players']:
        for h in p['round']['holes']:
            card=entry['scorecard']['holes'][str(h['hole'])]
            assert h['par']==card['par'] and h['teeDistanceM']==card[p['profile']['tee']]
            assert h['strokeIndexMen']==card['indexMen'] and h['strokeIndexLadies']==card['indexLadies']
    page.evaluate(maps.FAKE,'VECTOR')
    for hole in range(1,19):
        ui.click(page,'#lessonJgiMap');page.locator('#lessonHole').select_option(str(hole));maps.frames(page)
        expected=entry['data']['holes'][str(hole)]
        assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id')==str(expected['i'])
        observed=page.evaluate('''()=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players.find(p=>p.playerId===g.selectedPlayerId).round;return activeCourseData(r).holes[String(r.currentHole)];}''')
        assert observed==expected
        q=page.evaluate(maps.GEOMETRY);assert q['tee']['y']>q['green']['y']
        ui.click(page,'#lessonSatellite');maps.frames(page);maps.camera_fits(page)
    ui.click(page,'#lessonJgiMap');page.locator('#lessonHole').select_option('1');maps.frames(page)
    points=page.evaluate(courses.POINTS)
    for i in range(count):
        ui.select_player(page,g,i);ui.main_map_click(page,points['tee']);ui.click(page,'#lessonConfirmPosition');ui.click(page,'#lessonShotSave')
    g=ui.storage_group(page)
    assert all(len(p['round']['holes'][0]['shots'])==1 for p in g['players'])
    for p in g['players']:
        s=p['round']['holes'][0]['shots'][0]
        assert s['courseContext']['courseId']==entry['data']['courseId'] and s['courseContext']['holeId']==entry['data']['holes']['1']['i']
    ui.select_player(page,g,0);penalty(page,'OB',1);green(page,points['green'])
    ui.select_player(page,g,1);penalty(page,'HAZARD',2);green(page,points['green'])
    ui.select_player(page,g,0);ui.reveal(page,'#lessonPuttDistanceInput').fill('8');ui.click(page,'#lessonPuttShort')
    ui.select_player(page,g,1);ui.reveal(page,'#lessonPuttDistanceInput').fill('3');ui.click(page,'#lessonPuttLong')
    ui.select_player(page,g,0);ui.reveal(page,'#lessonPuttDistanceInput').fill('1');ui.click(page,'#lessonPuttHoled')
    assert ui.storage_group(page)['players'][1]['round']['currentHole']==1
    ui.select_player(page,g,1);ui.reveal(page,'#lessonPuttDistanceInput').fill('1');ui.click(page,'#lessonPuttHoled')
    for i in range(2,count):ui.select_player(page,g,i);ui.click(page,'#lessonHoled')
    g=ui.storage_group(page)
    assert all(p['round']['currentHole']==2 for p in g['players'])
    assert [p['round']['holes'][0]['score'] for p in g['players']]==[4,5]+[1]*(count-2)
    assert [p['round']['holes'][0]['putts'] for p in g['players']]==[2,2]+[0]*(count-2)
    assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id')==str(entry['data']['holes']['2']['i'])
    ui.select_player(page,g,0);ui.click(page,'#lessonReportOpen')
    ui.expect(page.locator('#lessonReport-overviewCourse')).to_contain_text(entry['data']['nine'])
    page.locator('[data-report-tab="summaryScreen"]').click()
    ui.expect(page.locator('[data-summary-metric="score"] b')).to_have_text('4')
    ui.expect(page.locator('#lessonSummary-multiReviewSub')).to_contain_text(entry['data']['nine'])
    page.screenshot(path=str(out/(label+'-'+str(entry['data']['courseId'])+'-report.png')))
    page.locator('[data-report-close]').click()
    sg=page.evaluate('''()=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),p=g.players[0],v=JGICourseLessonReport.build(p),h=v.round.holes[0],s={...h.shots[0],startLie:'TEE'};return {putt:v.sgValues.sgPutt,guard:computeShotSG(h,s,0,v.sg.info,v.round),handicap:p.round.holes[0].strokeIndexMen};}''')
    assert sg['putt'] is not None
    if entry['data']['courseId']==22983:assert sg['guard'] is None and sg['handicap'] is None
    before=ui.storage_group(page);cache=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    page.context.set_offline(True);ui.click(page,'#lessonSaveGroup');page.context.set_offline(False)
    saved=ui.storage_group(page);assert saved['players']==before['players']
    page.reload(wait_until='domcontentloaded');page.wait_for_selector('#lessonPlayers')
    assert ui.storage_group(page)==saved
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==cache
    assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id')==str(entry['data']['holes']['2']['i'])
    assert ui.personal_storage(page)==personal
    page.screenshot(path=str(out/(label+'-'+str(entry['data']['courseId'])+'-map.png')))
    # Removing the private file never changes Group records and never falls back to Jagorawi.
    ui.click(page,'#lessonPrivateForget');assert ui.storage_group(page)==saved
    ui.click(page,'#lessonManageClose');ui.expect(page.locator('#lessonMapStatus')).to_contain_text('GI 지도 데이터가 없습니다')
    assert page.evaluate('activeCourseData('+json.dumps(saved['players'][0]['round'])+')') is None
    page.reload(wait_until='domcontentloaded');page.wait_for_selector('#lessonPlayers');assert ui.storage_group(page)==saved
    import_file(page,path,cache=False);assert ui.storage_group(page)==saved
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY) is None
    ui.click(page,'#lessonManageClose')
    assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id')==str(entry['data']['holes']['2']['i'])
    return {'course':entry['data']['nine'],'holes':18,'players':count,'checks':'original mapping/GPS/18 JGI+simulated Satellite/auto alignment/free putting/penalty/report/score/SG guard/offline/cache refresh/file removal/reimport PASS','cache_bytes':len(cache)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--data',required=True);parser.add_argument('--zip',required=True);parser.add_argument('--out',default='/tmp/jgi-private-course-test');args=parser.parse_args()
    data=Path(args.data).resolve();bundle=json.loads(data.read_text());out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    result={'environment':'Cloud Chromium, synthetic players; external/API blocked; Satellite simulated; not physical Safari','original':verify_original(bundle,args.zip),'runs':[]}
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for w,h,label,count in [(390,844,'iphone',2),(820,1180,'ipad',4),(844,390,'iphone-landscape',3),(1180,820,'ipad-landscape',4),(320,740,'narrow',2)]:
                context=browser.new_context(viewport={'width':w,'height':h});context.add_init_script(ui.INIT_SCRIPT)
                requests=[];context.route('**/*',lambda route:ui.gate(route,base))
                page=context.new_page();page.set_default_timeout(20000);page.on('request',lambda r:requests.append(r.method));page.on('dialog',lambda d:d.accept())
                errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                runs=[flow(page,base,data,entry,count,out,label) for entry in bundle['courses']]
                assert not errors,errors
                assert 'POST' not in requests,'Unexpected upload/API POST'
                result['runs'].append({'viewport':[w,h],'courses':runs,'page_errors':errors,'uploads':0})
                (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(label+': both private courses PASS',flush=True);context.close()
            context=browser.new_context();context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base))
            page=context.new_page();page.goto(base+'/?courseLesson=1',wait_until='domcontentloaded');page.wait_for_selector('#lessonPlayers',state='attached')
            result['geometry_cache_version']=cache_version_flow(page,data.read_text());context.close();browser.close()
        result['status']='PASS';(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS: 5 viewports, private data never uploaded')
    finally:server.shutdown()

if __name__=='__main__':main()
