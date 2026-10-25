#!/usr/bin/env python3
"""Compact scorer layout/whole-hole fit. Local Chromium, synthetic players; SDK explicitly simulated."""
import argparse, functools, http.server, importlib.util, json, math, threading
from pathlib import Path

def load(name, filename):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

ui=load('ui','course-lesson-ui.test.py');maps=load('maps','course-lesson-map.test.py')
COURSES=[('Jagorawi Golf & Country Club','Old Course'),('Ora Country Club','South Left'),('Gunung Geulis','East Course'),('Gunung Geulis','West Course')]
CREATE=r"""({source,course,nine})=>{
 const E=new Function('module',source+'\nreturn module.exports;')({exports:{}}),descriptor={course,nine};
 const data=activeCourseData(descriptor),services={uuid:()=>crypto.randomUUID(),now:Date.now,
  courses:[{...descriptor,version:data.version||null}],dataVersion:JGI_SG_BENCHMARK_DATA.version,
  benchmark:sgBenchmarkInfo,hydrate:hydrateRoundCourseTruth};
 let g=E.createGroup(2,services,descriptor);
 for(const [i,p] of g.players.entries())g=E.registerPlayer(g,p.playerId,{name:'TEST Layout '+String.fromCharCode(65+i),contact:'',sex:i?'MALE':'FEMALE',handicap:String(5+i),tee:i?'Blue':'Red'},services);
 E.saveGroup(localStorage,g);return g;
}"""
OBSERVE=r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),p=g.players.find(p=>p.playerId===g.selectedPlayerId),r=p.round,h=activeCourseData(r).holes[String(r.currentHole)];
 const model=courseViewProjector(h,r,[]),svg=document.getElementById('lessonCourseSvg'),ctm=svg.getScreenCTM();
 const required=[{lat:h.t[0],lng:h.t[1]},{lat:h.g[0],lng:h.g[1]},...courseShapes(h,r).filter(s=>['HOLE_BOUNDARY','FAIRWAY','TEE','GREEN'].includes(s.type)).flatMap(s=>s.path)];
 const rect=id=>{const b=document.querySelector(id).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
 const project=point=>{const q=model.project(point),s=new DOMPoint(q.x,q.y).matrixTransform(ctm);return {x:s.x,y:s.y};};
 return {required,screen:required.map(project),tee:project(required[0]),green:project(required[1]),map:rect('.lessonMapHost'),header:rect('.lessonHeader'),panel:rect('#lessonShotPanel'),shell:rect('#courseLessonDev'),
  camera:window.__cameraMap?.snapshot(),heading:bearingDeg(required[0],required[1]),svgFrame:svg.getAttribute('viewBox'),
  playerCardHeight:document.querySelector('.lessonPlayer').getBoundingClientRect().height,
  paddingBottom:getComputedStyle(document.querySelector('#lessonShotPanel')).paddingBottom};
}"""
SYNTHETIC=r"""({boundary,heading})=>{
 const rect=(x0,y0,x1,y1)=>[[y0,x0],[y0,x1],[y1,x1],[y1,x0],[y0,x0]];
 const shapes=[['F',0,rect(-.00015,0,.00015,.004)],['T',0,rect(-.00005,-.00005,.00005,.00005)],['G',0,rect(-.00007,.00393,.00007,.00407)],
 ['B',0,rect(.00021,.0019,.00032,.0021)],['W',0,rect(.1,.1,.11,.11)],['P',1,[[.1,.1],[.11,.11]]],
 // At 315 degrees these lateral waters enter a north/east clip box despite being over 120m from the hole.
 ['W',0,rect(.0011,.0018,.0013,.0022)],['W',0,rect(-.0013,.0018,-.0011,.0022)]];
 if(boundary)shapes.unshift(['H',0,rect(-.0002,-.0001,.0002,.0041)]);
 const a=heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rotate=p=>[p[0]*c-p[1]*s,p[1]*c+p[0]*s];
 for(const shape of shapes)shape[2]=shape[2].map(rotate);
 const tee=[0,0],green=rotate([.004,0]);
 JGI_OLD_COURSE_DATA.holes['18']={i:999001,t:tee,g:green,s:shapes};
 return {near:shapes.find(x=>x[0]==='B')[2].map(p=>({lat:p[0],lng:p[1]})),tee,green};
}"""

def geometry(page):
    maps.frames(page);d=page.evaluate(OBSERVE);r=d['map']
    summary={k:v for k,v in d.items() if k not in ['required','screen']}
    assert r['height']>=59 and r['width']>0,summary
    assert r['y']>=d['header']['bottom']-1,summary
    assert r['bottom']<=d['panel']['y']+1,summary
    assert abs(d['panel']['bottom']-d['shell']['bottom'])<1,summary
    assert d['playerCardHeight']<=60,summary
    outside=[(i,q) for i,q in enumerate(d['screen']) if not(r['x']-1<=q['x']<=r['right']+1 and r['y']-1<=q['y']<=r['bottom']+1)]
    assert not outside,(summary,outside[:5],len(outside))
    assert d['tee']['y']>d['green']['y'] and abs(d['tee']['x']-d['green']['x'])<1,summary
    return d

def native_fit(page):
    d=page.evaluate(OBSERVE);v=d['camera'];r=page.locator('#lessonSatelliteMap').bounding_box();w=r['width'];h=r['height']
    points=[maps.projected(p,v['center'],v['heading'],v['zoom'],w,h) for p in d['required']]
    assert abs((v['heading']-d['heading']+180)%360-180)<1e-5
    outside=[p for p in points if not(-1<=p[0]<=w+1 and -1<=p[1]<=h+1)]
    assert not outside,(w,h,outside[:5],len(outside),v)
    assert points[0][1]>points[1][1]

def fresh(page,url,source,course,nine):
    ui.fixture(page,source,url,'empty',count=2)
    page.evaluate(CREATE,{'source':source,'course':course,'nine':nine});page.reload(wait_until='domcontentloaded')
    ui.expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    page.evaluate(maps.FAKE,'VECTOR');maps.frames(page)

def selected_tee(page):
    return page.evaluate("()=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players.find(p=>p.playerId===g.selectedPlayerId).round;return activeCourseData(r).holes[String(r.currentHole)].t;}")

def stage(page,tee):
    page.evaluate('t=>__cameraMap.emit("click",{latLng:{lat:()=>t[0],lng:()=>t[1]}})',tee)
    ui.click(page,'#lessonConfirmPosition');ui.click(page,'#lessonShotSave');maps.frames(page)

def run(page,url,source,out,label):
    cases=[]
    for course,nine in COURSES:
        fresh(page,url,source,course,nine)
        ui.expect(page.locator('#lessonShotDistance')).not_to_be_visible()
        before=ui.personal_storage(page)
        for hole in [1,2,3,18,1]:
            ui.click(page,'#lessonJgiMap');page.locator('#lessonHole').select_option(str(hole));d=geometry(page)
            if nine=='Old Course' and hole==2 and page.viewport_size['height']>page.viewport_size['width']:
                assert d['tee']['y']-d['green']['y']>=d['map']['height']*.45,d
            ui.click(page,'#lessonSatellite');maps.frames(page);native_fit(page)
        # Rotating a default view must refit the actual available rectangle without a hole change.
        viewport=dict(page.viewport_size)
        page.set_viewport_size({'width':viewport['height'],'height':viewport['width']});maps.frames(page);native_fit(page)
        ui.click(page,'#lessonJgiMap');geometry(page)
        page.set_viewport_size(viewport);maps.frames(page);geometry(page)
        ui.click(page,'#lessonSatellite');maps.frames(page);native_fit(page)
        ui.expect(page.locator('#lessonMapStatus')).not_to_be_visible()
        # Native camera and SVG viewport preserve genuine manual edits across shot saves and layout changes.
        page.evaluate('()=>{__cameraMap.emit("dragstart");__cameraMap.moveCamera({center:{lat:1,lng:1},zoom:17.75,heading:33,tilt:0});}')
        manual=maps.snapshot(page);ui.click(page,'#lessonJgiMap')
        page.locator('#lessonCourseSvg').evaluate('s=>s.setAttribute("viewBox","50 80 280 450")');frame=page.locator('#lessonCourseSvg').get_attribute('viewBox')
        page.locator('#lessonShotClub').evaluate('s=>{s.value="7I";s.dispatchEvent(new Event("change"));}')
        assert page.locator('#lessonCourseSvg').get_attribute('viewBox')==frame
        ui.expect(page.locator('#lessonStatus')).not_to_be_visible()
        ui.click(page,'#lessonSatellite');maps.frames(page);assert maps.snapshot(page)==manual
        stage(page,selected_tee(page));assert maps.snapshot(page)==manual
        ui.expect(page.locator('#lessonPenaltyMeta')).to_be_visible()
        ui.expect(page.locator('#lessonPenaltyMeta')).to_contain_text('Score 1')
        ui.expect(page.locator('#lessonPenaltyMeta')).to_contain_text('Putts 0')
        ui.expect(page.locator('#lessonPenaltyMeta')).to_contain_text('벌타 0')
        # A second saved location provides an actual Shot 1 distance, which must remain visible.
        next_position=page.evaluate("()=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players[0].round,h=activeCourseData(r).holes['1'];return [(h.t[0]*3+h.g[0])/4,(h.t[1]*3+h.g[1])/4];}")
        stage(page,next_position);assert maps.snapshot(page)==manual
        ui.expect(page.locator('#lessonShotDistance')).to_be_visible();assert 'm' in page.locator('#lessonShotDistance').inner_text()
        page.set_viewport_size({'width':viewport['height'],'height':viewport['width']});maps.frames(page)
        assert maps.snapshot(page)==manual
        ui.click(page,'#lessonJgiMap');assert page.locator('#lessonCourseSvg').get_attribute('viewBox')==frame
        page.set_viewport_size(viewport);maps.frames(page);assert page.locator('#lessonCourseSvg').get_attribute('viewBox')==frame
        ui.click(page,'#lessonSatellite');maps.frames(page);assert maps.snapshot(page)==manual
        ui.click(page,'#lessonOnGreen');maps.frames(page);ui.click(page,'#lessonGreenCancel');maps.frames(page);assert maps.snapshot(page)==manual
        # A real GPS failure must be visible even though ordinary save/help status is suppressed.
        ui.click(page,'#lessonGetGps');page.evaluate('()=>__jgiGpsRequests.at(-1).error({code:1})');maps.frames(page)
        ui.expect(page.locator('#lessonStatus')).to_be_visible();ui.expect(page.locator('#lessonStatus')).to_contain_text('GPS 권한')
        ui.click(page,'#lessonHoled');g=ui.storage_group(page);assert g['players'][0]['round']['currentHole']==1
        ui.select_player(page,g,1);stage(page,selected_tee(page));ui.click(page,'#lessonHoled');maps.frames(page)
        advanced=ui.storage_group(page);assert all(p['round']['currentHole']==2 for p in advanced['players'])
        assert advanced['selectedPlayerId']==g['players'][1]['playerId'];native_fit(page)
        ui.click(page,'#lessonJgiMap');d=geometry(page)
        assert ui.personal_storage(page)==before
        page.screenshot(path=str(out/(label+'-'+nine.replace(' ','-')+'.png')))
        cases.append({'course':course,'nine':nine,'mapHeight':d['map']['height'],'teeGreenPixels':d['tee']['y']-d['green']['y'],'cardHeight':d['playerCardHeight'],'bottomPadding':d['paddingBottom'],'checks':'whole core/insets/orientation/normal status hidden/errors visible/manual save/Green return/auto-next/data independence PASS'})
    # Isolated synthetic geometry proves distant adjacent water cannot force an excessively small fit.
    fresh(page,url,source,*COURSES[0])
    for boundary,heading in [(True,0),(False,0),(True,315),(False,315)]:
        ui.click(page,'#lessonJgiMap');synthetic=page.evaluate(SYNTHETIC,{'boundary':boundary,'heading':heading});near=synthetic['near'];page.locator('#lessonHole').select_option('18');d=geometry(page)
        assert d['tee']['y']-d['green']['y']>=d['map']['height']*.5,d
        visible=page.evaluate('''points=>{const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),r=g.players[0].round,h=activeCourseData(r).holes['18'],m=courseViewProjector(h,r,[]),svg=document.querySelector('#lessonCourseSvg');return points.map(p=>{const q=m.project(p),s=new DOMPoint(q.x,q.y).matrixTransform(svg.getScreenCTM());return {x:s.x,y:s.y};});}''',near)
        assert all(d['map']['x']-1<=p['x']<=d['map']['right']+1 and d['map']['y']-1<=p['y']<=d['map']['bottom']+1 for p in visible),(d,visible)
        ui.click(page,'#lessonSatellite');maps.frames(page);native_fit(page)
        camera=maps.snapshot(page);rect=page.locator('#lessonSatelliteMap').bounding_box()
        endpoints=[maps.projected({'lat':p[0],'lng':p[1]},camera['center'],camera['heading'],camera['zoom'],rect['width'],rect['height']) for p in [synthetic['tee'],synthetic['green']]]
        assert endpoints[0][1]-endpoints[1][1]>=rect['height']*.5,(rect,camera,endpoints)
        page.locator('#lessonHole').select_option('1');maps.frames(page)
    return cases

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-lesson-layout');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    source=(ui.REPO/'course-lesson.js').read_text();server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);result={'environment':'Cloud Chromium, synthetic player data and explicit existing-Map simulation; not physical Safari/real SDK','runs':[]}
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for w,h,label in [(390,844,'iphone'),(820,1180,'ipad'),(844,390,'iphone-landscape'),(1180,820,'ipad-landscape'),(320,740,'narrow')]:
                context=browser.new_context(viewport={'width':w,'height':h});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                cases=run(page,base+'/?courseLesson=1',source,out,label);assert not errors,errors
                result['runs'].append({'viewport':[w,h],'cases':cases,'page_errors':errors});(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(label+': four courses PASS',flush=True);context.close()
            browser.close()
        result['status']='PASS';(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS')
    finally:server.shutdown()

if __name__=='__main__':main()
