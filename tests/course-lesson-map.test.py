#!/usr/bin/env python3
"""Common-GI Tee/Green camera tests. Local Chromium and explicit Maps simulation, never real SDK validation."""
import argparse,functools,http.server,importlib.util,json,math,threading
from pathlib import Path
spec=importlib.util.spec_from_file_location('ui',Path(__file__).with_name('course-lesson-ui.test.py'));ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
FAKE=r"""type=>{
 const div=document.getElementById('googleMap'),events=new Map();
 class Marker{setMap(){}setPosition(){}setLabel(){}setZIndex(){}setIcon(){}}
 class Polygon{constructor(v){this.map=v.map;}setMap(v){this.map=v;}}
 class Bounds{constructor(){this.points=[];}extend(p){this.points.push({...p});}}
 const map={type,center:{lat:0,lng:0},zoom:3,heading:0,tilt:0,moves:[],fits:[],constructors:0,mapType:'satellite',
  getDiv:()=>div,getRenderingType(){return this.type;},getMapTypeId(){return this.mapType;},setMapTypeId(v){this.mapType=v;},
  getCenter(){return {lat:()=>this.center.lat,lng:()=>this.center.lng};},getZoom(){return this.zoom;},getHeading(){return this.heading;},getTilt(){return this.tilt;},
  addListener(name,fn){const set=events.get(name)||new Set();set.add(fn);events.set(name,set);return {remove:()=>set.delete(fn)};},
  emit(name,payload){for(const fn of events.get(name)||[])fn(payload);},listenerCount(name){return events.get(name)?.size||0;},
  moveCamera(v){this.center={...v.center};this.zoom=v.zoom;this.heading=v.heading??this.heading;this.tilt=v.tilt??this.tilt;this.moves.push(JSON.parse(JSON.stringify(v)));},
  fitBounds(v){this.fits.push(v.points);const p=v.points;this.center={lat:p.reduce((s,x)=>s+x.lat,0)/p.length,lng:p.reduce((s,x)=>s+x.lng,0)/p.length};this.zoom=19;this.heading=0;},
  snapshot(){return {center:this.center,zoom:this.zoom,heading:this.heading,tilt:this.tilt};}
 };
 window.google={maps:{Map:class{constructor(){map.constructors++;throw Error('A new Map must not be constructed');}},Marker,Polygon,LatLngBounds:Bounds,SymbolPath:{CIRCLE:0},event:{trigger(){}}}};
 window.__cameraMap=map;JGI_COURSE_LESSON_MAP.onReady(map);JGI_COURSE_LESSON_MAP.onReady(map);return true;
}"""
GEOMETRY=r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_dev_group_v1')),p=g.players.find(p=>p.playerId===g.selectedPlayerId),r=p.round,h=activeCourseData(r).holes[String(r.currentHole)],svg=document.getElementById('lessonCourseSvg');
 const m=courseViewProjector(h,r,[]),t=m.project({lat:h.t[0],lng:h.t[1]}),e=m.project({lat:h.g[0],lng:h.g[1]});
 const matrix=svg.getScreenCTM(),T=new DOMPoint(t.x,t.y).matrixTransform(matrix),G=new DOMPoint(e.x,e.y).matrixTransform(matrix),rect=svg.getBoundingClientRect();
 return {tee:{x:T.x,y:T.y},green:{x:G.x,y:G.y},rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},bearing:Number(svg.dataset.alignmentBearing),expected:bearingDeg({lat:h.t[0],lng:h.t[1]},{lat:h.g[0],lng:h.g[1]}),frame:svg.getAttribute('viewBox')};
}"""
RAW_CAMERA=r"""()=>{
 const g=JSON.parse(localStorage.getItem('jgi_course_lesson_dev_group_v1')),p=g.players.find(p=>p.playerId===g.selectedPlayerId),h=activeCourseData(p.round).holes[String(p.round.currentHole)],shapes=courseShapes(h,p.round),boundary=shapes.filter(s=>s.type==='HOLE_BOUNDARY').flatMap(s=>s.path);
 return {camera:__cameraMap.snapshot(),points:[{lat:h.t[0],lng:h.t[1]},{lat:h.g[0],lng:h.g[1]},...(boundary.length?boundary:shapes.flatMap(s=>s.path))],expected:bearingDeg({lat:h.t[0],lng:h.t[1]},{lat:h.g[0],lng:h.g[1]}),rect:(()=>{const r=document.getElementById('lessonSatelliteMap').getBoundingClientRect();return {width:r.width,height:r.height}})()};
}"""
PURE=r"""()=>{
 const A=JGICourseLessonMapAlignment,eq=(x,y)=>{if(Math.abs(x-y)>1e-8)throw Error('bearing '+x+' vs '+y);};
 for(const [g,b] of [[{lat:1,lng:0},0],[{lat:0,lng:1},90],[{lat:-1,lng:0},180],[{lat:0,lng:-1},270]])eq(A.bearing({lat:0,lng:0},g),b);
 if(A.alignment({g:[1,1]},{}).heading!==null||A.alignment({t:[1,1]},{}).heading!==null||A.alignment({t:[1,1],g:[1,1]},{}).heading!==null)throw Error('missing geometry fabricated');
 const h={t:[0,0],g:[1,1]},before=JSON.stringify(h);eq(A.alignment(h,{tee:'Blue',gps:{lat:80,lng:80}}).heading,A.alignment(h,{tee:'Red',gps:{lat:-80,lng:-80}}).heading);if(JSON.stringify(h)!==before)throw Error('geometry changed');
 return 'cardinal bearings, common reference independent of Tee color/GPS, missing/duplicate coordinates PASS';
}"""
def frames(page):page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
def snapshot(page):return page.evaluate('()=>__cameraMap.snapshot()')
def moves(page):return page.evaluate('()=>__cameraMap.moves.length')
def projected(p,center,heading,zoom,w,h):
 def world(q):return ((q['lng']+180)/360,(1-math.log(math.tan(math.pi/4+q['lat']*math.pi/360))/math.pi)/2)
 x,y=world(p);cx,cy=world(center);dx=(x-cx+.5)%1-.5;dy=y-cy;c=math.cos(math.radians(heading));s=math.sin(math.radians(heading));scale=256*2**zoom
 return (w/2+(dx*c+dy*s)*scale,h/2+(-dx*s+dy*c)*scale)
def camera_fits(page):
 d=page.evaluate(RAW_CAMERA);v=d['camera'];w=d['rect']['width'];h=d['rect']['height'];xy=[projected(p,v['center'],v['heading'],v['zoom'],w,h) for p in d['points']]
 assert abs((v['heading']-d['expected']+180)%360-180)<1e-6
 assert all(-1<=x<=w+1 and -1<=y<=h+1 for x,y in xy),(w,h,xy)
 assert xy[0][1]>xy[1][1] and abs(xy[0][0]-xy[1][0])<1,(xy[:2],v)
 return {'bearing':v['heading'],'zoom':v['zoom'],'width':w,'height':h}
def layout_metrics(page):
 frames(page);g=page.evaluate(GEOMETRY);r=page.locator('.lessonMapHost').bounding_box();return {'mapHeight':r['height'],'teeGreenPixels':g['tee']['y']-g['green']['y'],'bottomPadding':page.locator('#lessonShotPanel').evaluate('e=>getComputedStyle(e).paddingBottom')}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--baseline',default='');parser.add_argument('--out',default='/tmp/jgi-map-alignment');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);repo=ui.REPO;source=(repo/'course-lesson.js').read_text()
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(repo)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);url=base+'/?courseLessonDev=1'
 baseline_server=None;baseline_base=None
 if args.baseline:
  baseline_server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(Path(args.baseline).resolve())));threading.Thread(target=baseline_server.serve_forever,daemon=True).start();baseline_base='http://127.0.0.1:'+str(baseline_server.server_address[1])
 result={'environment':'Cloud Chromium. Satellite uses an explicit simulated existing Map, not real Google SDK/Safari confirmation.','runs':[]}
 try:
  with ui.sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   for width,height,label in [(390,844,'iphone'),(820,1180,'ipad'),(844,390,'iphone-landscape'),(1180,820,'ipad-landscape'),(320,740,'narrow')]:
    context=browser.new_context(viewport={'width':width,'height':height});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base));page=context.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    ui.fixture(page,source,url,'empty',count=2)
    # Use real registration functions so Blue/Red Scorecard/SG/profile data stays consistent.
    page.evaluate(r'''source=>{const E=new Function('module',source+'\nreturn module.exports;')({exports:{}});let g=E.restoreGroup(localStorage);for(const [i,p] of g.players.entries())g=E.registerPlayer(g,p.playerId,{...p.draft,tee:i===0?'Blue':'Red'},{uuid:()=>crypto.randomUUID(),now:Date.now,benchmark:sgBenchmarkInfo,hydrate:hydrateRoundCourseTruth,dataVersion:JGI_SG_BENCHMARK_DATA.version});E.saveGroup(localStorage,g);}''',source);page.reload(wait_until='domcontentloaded');assert page.evaluate(PURE)
    initial=layout_metrics(page);page.screenshot(path=str(out/f'mobile-after-{label}.png'));comparison=None
    if baseline_base:
     baseline_context=browser.new_context(viewport={'width':width,'height':height});baseline_context.add_init_script(ui.INIT_SCRIPT);baseline_context.route('**/*',lambda route:ui.gate(route,baseline_base));old=baseline_context.new_page();old.on('dialog',lambda d:d.accept());ui.fixture(old,(Path(args.baseline)/'course-lesson.js').read_text(),baseline_base+'/?courseLessonDev=1','empty',count=2);before=layout_metrics(old);old.screenshot(path=str(out/f'mobile-before-{label}.png'));baseline_context.close();comparison={'baseline':before,'current':initial};assert initial['mapHeight']>=before['mapHeight']-2 and initial['teeGreenPixels']>before['teeGreenPixels'],comparison
    page.evaluate(FAKE,'VECTOR');frames(page);bearings=[]
    for hole in [1,2,3]:
     page.locator('#lessonJgiMap').click();page.locator('#lessonHole').select_option(str(hole));frames(page);geom=page.evaluate(GEOMETRY)
     assert geom['tee']['y']>geom['green']['y'] and abs(geom['tee']['x']-geom['green']['x'])<1
     r=geom['rect'];assert all(r['y']-1<=geom[k]['y']<=r['y']+r['h']+1 for k in ['tee','green'])
     page.screenshot(path=str(out/f'jgi-hole{hole}-{label}.png'));page.locator('#lessonSatellite').click();frames(page);bearings.append(camera_fits(page))
    g=ui.storage_group(page);tees=[p['round']['tee'] for p in g['players']];distances=[p['round']['holes'][2]['teeDistanceM'] for p in g['players']];assert tees==['Blue','Red'] and distances[0]!=distances[1]
    # Align B to the same hole; switching color on the common reference does not reset this shared view.
    page.locator('#lessonPlayers .lessonPlayer').nth(1).click();page.locator('#lessonHole').select_option('3');frames(page);camera_fits(page);count=moves(page);page.locator('#lessonPlayers .lessonPlayer').nth(0).click();frames(page);assert moves(page)==count
    page.evaluate('()=>{__cameraMap.moveCamera({center:{lat:-6.452,lng:106.880},zoom:18.25,heading:37,tilt:0});__cameraMap.emit("idle");}');manual=snapshot(page);count=moves(page)
    page.locator('#lessonJgiMap').click();page.locator('#lessonCourseSvg').evaluate('el=>el.setAttribute("viewBox","60 80 280 480")');viewbox=page.locator('#lessonCourseSvg').get_attribute('viewBox')
    page.locator('#lessonShotClub').evaluate('el=>{el.value="7I";el.dispatchEvent(new Event("change"));}');assert page.locator('#lessonCourseSvg').get_attribute('viewBox')==viewbox
    page.locator('#lessonSatellite').click();frames(page);assert snapshot(page)==manual and moves(page)==count
    page.evaluate('()=>{const g=JSON.parse(localStorage.getItem("jgi_course_lesson_dev_group_v1")),r=g.players[0].round,t=activeCourseData(r).holes["3"].t;__cameraMap.emit("click",{latLng:{lat:()=>t[0],lng:()=>t[1]}});}');page.locator('#lessonConfirmPosition').click();page.locator('#lessonShotSave').click();frames(page);assert snapshot(page)==manual and moves(page)==count
    raw_before=ui.storage_group(page);page.locator('#lessonOnGreen').click();frames(page);assert page.locator('#googleMap').evaluate('el=>el.parentElement.id')=='lessonGreenSatellite';page.locator('#lessonGreenCancel').click();frames(page);assert snapshot(page)==manual;assert ui.storage_group(page)==raw_before
    page.locator('#lessonJgiMap').click();page.locator('#lessonSatellite').click();frames(page);assert snapshot(page)==manual
    assert '회전 적용 확인 실패' not in page.locator('#lessonMapStatus').inner_text()
    assert page.evaluate('()=>__cameraMap.constructors')==0;assert page.evaluate('()=>__cameraMap.listenerCount("click")')==1
    page.locator('#lessonJgiMap').click();frames(page);layout=page.evaluate('()=>{const a=document.getElementById("courseLessonDev").getBoundingClientRect(),p=document.getElementById("lessonShotPanel").getBoundingClientRect(),m=document.querySelector(".lessonMapHost").getBoundingClientRect();return {bottom:a.bottom,panelBottom:p.bottom,mapHeight:m.height,mapBottom:m.bottom,panelTop:p.top,padding:getComputedStyle(document.getElementById("lessonShotPanel")).paddingBottom,vh:innerHeight};}')
    assert abs(layout['bottom']-layout['vh'])<1 and abs(layout['panelBottom']-layout['bottom'])<1 and abs(layout['mapBottom']-layout['panelTop'])<2,layout
    page.screenshot(path=str(out/f'jgi-recording-{label}.png'))
    # Automatic next-hole alignment uses the same instance and preserves the selected player.
    ui.fixture(page,source,url,'auto',count=2);page.evaluate(FAKE,'VECTOR');page.locator('#lessonSatellite').click();frames(page);selected=ui.storage_group(page)['selectedPlayerId'];page.locator('#lessonHoled').click();frames(page);assert all(p['round']['currentHole']==2 for p in ui.storage_group(page)['players']);assert ui.storage_group(page)['selectedPlayerId']==selected;camera_fits(page)
    # Unsupported and late-ready rendering types are reported, with no extra Map construction.
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'RASTER');page.locator('#lessonSatellite').click();frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('회전 미지원');page.evaluate('()=>{__cameraMap.type="VECTOR";__cameraMap.emit("renderingtype_changed");}');frames(page);camera_fits(page)
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'UNINITIALIZED');page.locator('#lessonSatellite').click();frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('확인 불가');page.locator('#googleMap').dispatch_event('pointerdown',{'pointerId':1,'clientX':100,'clientY':200});page.locator('#googleMap').dispatch_event('pointerup',{'pointerId':1,'clientX':100,'clientY':200});page.evaluate('()=>{__cameraMap.type="VECTOR";__cameraMap.emit("renderingtype_changed");}');frames(page);camera_fits(page)
    # A real manual gesture before rendering readiness is never overwritten by a late type event.
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'UNINITIALIZED');page.locator('#lessonSatellite').click();frames(page);page.evaluate('()=>{__cameraMap.emit("dragstart");__cameraMap.moveCamera({center:{lat:-6.454,lng:106.88},zoom:18,heading:23,tilt:0});}');custom=snapshot(page);count=moves(page);page.evaluate('()=>{__cameraMap.type="VECTOR";__cameraMap.emit("renderingtype_changed");}');frames(page);assert snapshot(page)==custom and moves(page)==count;ui.expect(page.locator('#lessonMapStatus')).to_contain_text('수동 지도 유지')
    # Manual movement during heading verification is not misreported as an SDK rotation failure.
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'VECTOR');page.evaluate('()=>{__cameraMap.getHeading=()=>undefined;}');page.locator('#lessonSatellite').click();frames(page);page.evaluate('()=>{__cameraMap.emit("dragstart");__cameraMap.getHeading=()=>23;__cameraMap.emit("idle");}');frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('수동 지도 유지')
    # A VECTOR API that ignores heading is reported as unverified, not successful.
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'VECTOR');page.evaluate('()=>{__cameraMap.getHeading=()=>0;}');page.locator('#lessonSatellite').click();frames(page);page.evaluate('__cameraMap.emit("idle")');frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('회전 적용 확인 실패')
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'VECTOR');page.evaluate('()=>{__cameraMap.moveCamera=()=>{throw Error("SIMULATED_SDK_FAILURE")};}');page.locator('#lessonSatellite').click();frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('카메라 적용 실패')
    ui.fixture(page,source,url,'empty',count=1);page.evaluate(FAKE,'VECTOR');page.locator('#lessonSatellite').click();frames(page)
    # Missing common Tee/Green is explicitly unaligned; no colored Tee is synthesized.
    page.evaluate('()=>{delete JGI_OLD_COURSE_DATA.holes["2"].t;}');page.locator('#lessonHole').select_option('2');frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('Tee GPS 없음');assert page.locator('#lessonCourseSvg').get_attribute('data-alignment-bearing')==''
    page.evaluate('()=>{delete JGI_OLD_COURSE_DATA.holes["3"].g;}');page.locator('#lessonHole').select_option('3');frames(page);ui.expect(page.locator('#lessonMapStatus')).to_contain_text('Green Center GPS 없음')
    assert not errors,errors
    result['runs'].append({'viewport':[width,height],'holes':bearings,'layout':layout,'mobileComparison':comparison,'checks':'common GI orientation/whole-hole fit/manual camera & SVG frame/save/mode switch/Green return/A-B Tee metadata/auto next/one instance/SDK capability/missing GPS PASS'});context.close()
   browser.close()
  result['status']='PASS'
 except Exception as e:result['status']='FAIL';result['error']=str(e);raise
 finally:
  (out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));server.shutdown()
  if baseline_server:baseline_server.shutdown()
 print(json.dumps({'status':result['status'],'out':str(out),'viewports':len(result['runs'])},ensure_ascii=False))
if __name__=='__main__':main()
