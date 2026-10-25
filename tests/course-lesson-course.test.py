#!/usr/bin/env python3
"""Real loaded-course selection, local Chromium, synthetic players; all external/API traffic blocked."""
import argparse
import functools
import http.server
import importlib.util
import json
import threading
from pathlib import Path

def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

ui = load('ui', 'course-lesson-ui.test.py')
maps = load('maps', 'course-lesson-map.test.py')
COURSES = [('Jagorawi Golf & Country Club', 'Old Course', 22987), ('Ora Country Club', 'South Left', 34617)]
POINTS = r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players[0].round;
 const h=activeCourseData(r).holes['1'];
 const inside=type=>{
  for(const shape of courseShapes(h,r).filter(s=>s.type===type&&!s.line)){
   const pts=shape.path,lat=pts.map(p=>p.lat),lng=pts.map(p=>p.lng);
   for(let y=3;y<18;y++)for(let x=3;x<18;x++){
    const p={lat:Math.min(...lat)+(Math.max(...lat)-Math.min(...lat))*y/20,lng:Math.min(...lng)+(Math.max(...lng)-Math.min(...lng))*x/20};
    if(pointInPolygonXY({x:p.lng,y:p.lat},pts.map(p=>({x:p.lng,y:p.lat})))&&
      Math.min(...pts.map((a,i)=>{const b=pts[(i+1)%pts.length];return pointToGeoSegmentDistanceM(p,[a.lat,a.lng],[b.lat,b.lng]);}))>1)return p;
   }
  }throw Error('No real GI polygon interior for '+type);
 };
 return {tee:inside('TEE'),green:inside('GREEN')};
}"""
PARITY = r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),raw=JSON.stringify(g),personal=JSON.stringify(round);
 const values=g.players.map(player=>{
  const v=JGICourseLessonReport.build(player),r=v.round,info=sgBenchmarkInfo(r);
  for(const record of v.records){
   const h=r.holes[record.hole-1],i=record.number-1;
   const expected=record.kind==='SHOT'?computeShotSG(h,h.shots[i],i,info,r):computePuttSG(h,h.puttsDetail[i],i,info);
   if(record.value!==(expected?.value??null))throw Error('ROUND SG parity mismatch');
  }
  const card=activeCourseScorecard(r),data=activeCourseData(r);
  if(r.courseTruth.courseId!==data.courseId||card.course!==r.course||card.courseName!==r.nine)throw Error('Course routing mismatch');
  for(const h of r.holes){
   const expected=scorecardHoleData(h.hole,r.tee,r);
   if(h.par!==expected.par||h.teeDistanceM!==expected.distanceM)throw Error('Wrong scorecard/Tee data');
  }
  return {player:r.playerName,courseId:data.courseId,tee:r.tee,version:r.courseVersion,sg:v.sgValues,records:v.records};
 });
 if(JSON.stringify(JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')))!==raw||JSON.stringify(round)!==personal)throw Error('Report modified raw/personal data');
 return values;
}"""

def flow(page, url, course, nine, course_id, out, label, dialogs):
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_selector('#lessonCourseSelect', state='attached')
    before = ui.personal_storage(page)
    options = page.locator('#lessonCourseSelect option').all_text_contents()
    assert options == [c[0] for c in COURSES], options
    ui.reveal(page, '#lessonCourseSelect').select_option(course)
    ui.expect(page.locator('#lessonCourseNine')).to_have_value(nine)
    assert page.locator('#lessonCourseNine option').all_text_contents() == [nine]
    page.locator('#lessonPlayerCount').select_option('2')
    ui.assert_inside_viewport(page, '#lessonCourseSelect')
    ui.assert_inside_viewport(page, '#lessonCourseNine')
    page.screenshot(path=str(out / f'setup-{course_id}-{label}.png'))
    ui.click(page, '#lessonCreateGroup')
    g = ui.storage_group(page)
    assert (g['course'], g['nine']) == (course, nine)
    for i, p in enumerate(g['players']):
        page.locator('#lessonManagePlayer').select_option(p['playerId'])
        page.locator('#lessonName').fill('TEST Course ' + chr(65+i))
        page.locator('#lessonContact').fill('')
        page.locator('#lessonSex').select_option('FEMALE' if i == 0 else 'MALE')
        page.locator('#lessonHandicap').fill('5' if i == 0 else '12')
        page.locator('#lessonTee').select_option('Red' if i == 0 else 'Blue')
        ui.click(page, '#lessonRegisterPlayer')
    g = ui.storage_group(page)
    ui.select_player(page, g, 0)
    ui.click(page, '#lessonManageClose') if page.locator('#lessonManageDialog').is_visible() else None
    assert all((p['round']['course'], p['round']['nine']) == (course, nine) for p in g['players'])
    initial = page.evaluate(PARITY)
    assert [v['tee'] for v in initial] == ['Red', 'Blue']
    if course_id == 34617:
        assert all(v['version'] == 'GI_ORA_SOUTH_LEFT_2026_10_09_V1' for v in initial)
    page.evaluate(maps.FAKE, 'VECTOR')
    for hole in [1, 2, 3, 1]:
        ui.click(page, '#lessonJgiMap')
        page.locator('#lessonHole').select_option(str(hole))
        maps.frames(page)
        expected_id = page.evaluate('''()=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players[0].round;return activeCourseData(r).holes[String(r.currentHole)].i;}''')
        assert page.locator('#lessonCourseSvg').get_attribute('data-hole-id') == str(expected_id)
        geometry = page.evaluate(maps.GEOMETRY)
        assert geometry['tee']['y'] > geometry['green']['y']
        ui.click(page, '#lessonSatellite')
        maps.frames(page)
        maps.camera_fits(page)
    ui.click(page, '#lessonJgiMap')
    points = page.evaluate(POINTS)
    ui.main_map_click(page, points['tee'])
    ui.click(page, '#lessonConfirmPosition')
    ui.click(page, '#lessonShotSave')
    raw = ui.storage_group(page)
    shot = raw['players'][0]['round']['holes'][0]['shots'][0]
    assert shot['courseContext']['courseId'] == course_id
    assert shot['courseContext']['course'] == course
    # New-course controls configure only a new Group; they cannot mutate any active records.
    other = COURSES[1] if course_id == 22987 else COURSES[0]
    ui.reveal(page, '#lessonCourseSelect').select_option(other[0])
    assert ui.storage_group(page) == raw
    ui.expect(page.locator('#lessonGroupMeta')).to_contain_text(course + ' / ' + nine)
    dialogs['accept'] = False
    ui.click(page, '#lessonCreateGroup')
    dialogs['accept'] = True
    assert ui.storage_group(page) == raw
    ui.click(page, '#lessonManageClose')
    ui.click(page, '#lessonPenaltyOpen')
    page.locator('#lessonPenaltyTypeChoice [data-v="OB"]').click()
    ui.click(page, '#lessonSavePenaltyBtn')
    ui.click(page, '#lessonOnGreen')
    # Green Popup prefers the connected native Map even when the main mode is JGI.
    page.evaluate('p=>__cameraMap.emit("click",{latLng:{lat:()=>p.lat,lng:()=>p.lng}})', points['green'])
    ui.click(page, '#lessonGreenSkipPin')
    ui.click(page, '#lessonGreenSave')
    ui.expect(page.locator('#lessonPutting')).not_to_be_visible()
    ui.reveal(page, '#lessonPuttDistanceInput').fill('8')
    ui.click(page, '#lessonPuttShort')
    ui.reveal(page, '#lessonPuttDistanceInput').fill('1')
    ui.click(page, '#lessonPuttHoled')
    g = ui.storage_group(page)
    a, b = g['players']
    h = a['round']['holes'][0]
    assert (h['score'], len(h['shots']), h['putts'], h['penalties']) == (4, 1, 2, 1)
    assert b['round']['holes'][0]['shots'] == [] and not b['round']['holes'][0]['completed']
    assert a['round']['currentHole'] == 1  # B has not finished.
    parity = page.evaluate(PARITY)
    assert len(parity[0]['records']) == 3 and parity[1]['records'] == []
    assert parity[0]['sg']['sgPutt'] is not None
    # Keep the original cumulative/ROUND reports and their global state independent.
    ui.click(page, '#lessonReportOpen')
    ui.expect(page.locator('#lessonReport-overviewCourse')).to_contain_text(course + ' · ' + nine)
    page.locator('[data-report-tab="summaryScreen"]').click()
    ui.expect(page.locator('#lessonSummary-multiReviewSub')).to_contain_text(course + ' · ' + nine)
    ui.expect(page.locator('[data-summary-metric="score"] b')).to_have_text('4')
    page.screenshot(path=str(out / f'report-{course_id}-{label}.png'))
    page.locator('[data-report-close]').click()
    ui.select_player(page, g, 1)
    ui.click(page, '#lessonReportOpen')
    ui.expect(page.locator('#lessonReportTitle')).to_contain_text('TEST Course B')
    page.locator('[data-report-close]').click()
    saved = ui.storage_group(page)
    page.context.set_offline(True)
    ui.click(page, '#lessonSaveGroup')
    assert {k:v for k,v in ui.storage_group(page).items() if k != 'updatedAt'} == {k:v for k,v in saved.items() if k != 'updatedAt'}
    page.context.set_offline(False)
    saved = ui.storage_group(page)
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#lessonPlayers')
    assert ui.storage_group(page) == saved
    ui.expect(ui.reveal(page, '#lessonCourseSelect')).to_have_value(course)
    ui.expect(page.locator('#lessonCourseNine')).to_have_value(nine)
    assert ui.personal_storage(page) == before
    ui.click(page, '#lessonManageClose')
    page.screenshot(path=str(out / f'map-{course_id}-{label}.png'))
    return {'course': course, 'nine': nine, 'courseId': course_id, 'checks': 'selection/register/map/Satellite/shot/Green/putts/penalty/SG/reports/lock/restore/offline PASS', 'sg': parity[0]['sg']}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='/tmp/jgi-course-selection')
    args = parser.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(ui.SafeHandler, directory=str(ui.REPO)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:' + str(server.server_address[1])
    result = {'environment': 'Cloud Chromium, synthetic players, external/API blocked; Satellite simulated, no real SDK/Safari confirmation', 'runs': []}
    try:
        with ui.sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            for width, height, label in [(390,844,'iphone'), (820,1180,'ipad'), (844,390,'iphone-landscape'), (1180,820,'ipad-landscape'), (320,740,'narrow')]:
                context = browser.new_context(viewport={'width':width,'height':height})
                context.add_init_script(ui.INIT_SCRIPT)
                context.route('**/*', lambda route: ui.gate(route, base))
                page = context.new_page(); page.set_default_timeout(15000)
                errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
                dialogs = {'accept': True}
                page.on('dialog', lambda d: d.accept() if dialogs['accept'] else d.dismiss())
                runs = [flow(page, base+'/?courseLesson=1', *course, out, label, dialogs) for course in COURSES]
                assert not errors, errors
                result['runs'].append({'viewport':[width,height], 'courses':runs, 'page_errors':errors})
                (out/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
                print(label + ': both courses PASS', flush=True)
                context.close()
            # An unconnected ROUND option or a missing scorecard never becomes a selectable Lesson course.
            context = browser.new_context(); context.add_init_script(ui.INIT_SCRIPT)
            context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{delete window.JGI_ORA_SOUTH_LEFT_SCORECARD_DATA;});")
            context.route('**/*', lambda route: ui.gate(route, base))
            page = context.new_page(); page.goto(base+'/?courseLesson=1', wait_until='domcontentloaded')
            page.wait_for_selector('#lessonCourseSelect option', state='attached')
            assert page.locator('#lessonCourseSelect option').all_text_contents() == [COURSES[0][0]]
            result['missing_scorecard_excluded'] = 'PASS'
            context.close(); browser.close()
        result['status'] = 'PASS'
        (out/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
