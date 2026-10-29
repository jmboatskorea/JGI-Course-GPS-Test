#!/usr/bin/env python3
"""Safe-area/visualViewport simulation in local Chromium, not physical iPhone or Google SDK testing."""
import argparse,functools,hashlib,http.server,importlib.util,json,threading
from pathlib import Path
from urllib.parse import urlparse

def load(name,file):
    s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

ui=load('iphone_ui','course-lesson-ui.test.py');maps=load('iphone_maps','course-lesson-map.test.py')
VIEWPORT=r"""({height,safeTop,safeBottom})=>{
 const state={height},v=new EventTarget();
 for(const [key,get] of Object.entries({height:()=>state.height,width:()=>innerWidth,offsetTop:()=>0,offsetLeft:()=>0,scale:()=>1}))Object.defineProperty(v,key,{get});
 Object.defineProperty(window,'visualViewport',{get:()=>v,configurable:true});
 window.__lessonViewport={setHeight(height){state.height=height;document.documentElement.style.setProperty('--test-probe-height',height+'px');v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));}};
 const install=()=>{document.documentElement.style.setProperty('--test-probe-height',state.height+'px');const style=document.createElement('style');style.textContent='.lessonViewportMeasure{height:var(--test-probe-height)!important}:root,.courseLessonDev,.lessonReportDialog{--lesson-safe-top:'+safeTop+'px!important;--lesson-safe-bottom:'+safeBottom+'px!important;--lesson-safe-left:0px!important;--lesson-safe-right:0px!important;}';document.head.append(style);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}"""
MEASURE=r"""()=>{
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right,width:r.width};};
 const visible=e=>{const r=e.getBoundingClientRect();return e instanceof HTMLElement&&r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 const last=items=>Math.max(0,...[...items].filter(visible).map(e=>e.getBoundingClientRect().bottom));
 const panel=document.querySelector('#lessonShotPanel'),report=document.querySelector('.lessonReportDialog[open]');
 const result={viewport:{innerHeight,visualHeight:visualViewport.height,offsetTop:visualViewport.offsetTop},shell:rect(document.querySelector('#courseLessonDev')),header:rect(document.querySelector('.lessonHeader')),panel:rect(panel),map:rect(document.querySelector('.lessonMapHost')),panelLastDirectBottom:last(panel.children),panelPadding:getComputedStyle(panel).paddingBottom,contentSafeBottom:parseFloat(getComputedStyle(document.querySelector('#courseLessonDev')).getPropertyValue('--lesson-content-safe-bottom'))||0,panelScroll:panel.scrollTop};
 if(report){const app=report.querySelector('.app'),content=report.querySelector('[data-report-content]'),active=[...content.children].find(visible),button=report.querySelector('[data-report-close]'),b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
 result.report={dialog:rect(report),app:rect(app),active:rect(active),lastDirectBottom:last(active.children),lastLeafBottom:last([...active.querySelectorAll('*')].filter(e=>![...e.children].some(visible))),lastCardBottom:last(active.querySelectorAll('.card,.dataNote,.multiPanel,.multiSection')),close:rect(button),closeHit:!!hit&&(hit===button||button.contains(hit)),scrollTop:report.scrollTop,scrollHeight:report.scrollHeight,clientHeight:report.clientHeight};}
 return result;
}"""
OPTIONS={'cameraControl':True,'scaleControl':True,'keyboardShortcuts':True,'zoomControl':False,'streetViewControl':False,'mapTypeControl':False,'gestureHandling':'greedy'}
FAKE=maps.FAKE.replace('window.__cameraMap=map;',"map.options="+json.dumps(OPTIONS)+";map.optionWrites=[];map.get=function(k){return this.options[k];};map.setOptions=function(value){this.optionWrites.push({...value});Object.assign(this.options,value);};window.__cameraMap=map;")

def frames(page):
    maps.frames(page);maps.frames(page)

def gate(route,base,case):
    path=urlparse(route.request.url).path
    if route.request.url.startswith(base+'/') and path in ['/','/index.html','/course-lesson.css']:
        # Chromium env() is zero: emulate the same environment as the baseline, including legacy rules.
        filename='index.html' if path in ['/','/index.html'] else 'course-lesson.css'
        body=(ui.REPO/filename).read_text()
        for name,value in [('top',case['safeTop']),('bottom',case['safeBottom']),('left',0),('right',0)]:
            body=body.replace('env(safe-area-inset-'+name+')',str(value)+'px')
        route.fulfill(status=200,content_type='text/css' if filename.endswith('.css') else 'text/html',body=body)
    else:ui.gate(route,base)

def snapshot(page):
    return {'group':page.evaluate('(k)=>localStorage.getItem(k)',ui.GROUP_KEY),'personal':ui.personal_storage(page),'round':page.evaluate('JSON.stringify(round)'),'archive':page.evaluate('localStorage.getItem("jgi_course_lesson_archive_v1")')}

def sdk_options(page):
    before=snapshot(page);page.evaluate(FAKE,'VECTOR');frames(page)
    expected={**OPTIONS,'cameraControl':False,'scaleControl':False,'keyboardShortcuts':False}
    assert page.evaluate('()=>__cameraMap.options')==expected
    assert page.evaluate('()=>__cameraMap.constructors')==0
    page.evaluate("()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
    assert page.evaluate('()=>__cameraMap.options')==OPTIONS
    page.evaluate("()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");frames(page)
    assert page.evaluate('()=>__cameraMap.options')==expected
    page.evaluate('()=>{window.__firstLessonMap=__cameraMap;}');page.evaluate(FAKE,'VECTOR');frames(page)
    assert page.evaluate('()=>__firstLessonMap.options')==OPTIONS
    assert page.evaluate('()=>__cameraMap.options')==expected
    assert page.evaluate('()=>__cameraMap.constructors+__firstLessonMap.constructors')==0
    page.evaluate("()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
    assert page.evaluate('()=>__cameraMap.options')==OPTIONS
    page.evaluate("()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");frames(page)
    assert snapshot(page)==before
    return 'Official existing-Map options apply/restore/reapply/replacement; no new Map; data unchanged PASS'

def play_geometry(page,safe_bottom):
    page.locator('#lessonShotPanel').evaluate('e=>e.scrollTop=e.scrollHeight');frames(page);d=page.evaluate(MEASURE)
    assert abs(d['shell']['top']-d['viewport']['offsetTop'])<=1,d
    assert abs(d['shell']['bottom']-d['viewport']['visualHeight'])<=1,d
    assert abs(d['panel']['bottom']-d['shell']['bottom'])<=1,d
    assert abs(d['map']['bottom']-d['panel']['top'])<=1,d
    gap=d['panel']['bottom']-d['panelLastDirectBottom']
    assert -1<=gap<=max(2,d['contentSafeBottom'])+4,(gap,d)
    assert 2<=float(d['panelPadding'].removesuffix('px'))<=max(2,d['contentSafeBottom'])+1,d
    return d

def reports(page,safe_top,safe_bottom,out,label,state):
    original=snapshot(page);results=[]
    for tab in ['overviewScreen','performanceScreen','summaryScreen']:
        ui.click(page,'#lessonReportOpen');page.locator('[data-report-tab="'+tab+'"]').click()
        page.locator('.lessonReportDialog').evaluate('e=>e.scrollTop=(e.scrollHeight-e.clientHeight)/2');frames(page);middle=page.evaluate(MEASURE)
        assert middle['report']['closeHit'] and middle['report']['close']['top']>=safe_top-1,middle
        page.locator('.lessonReportDialog').evaluate('e=>e.scrollTop=e.scrollHeight');frames(page);d=page.evaluate(MEASURE);r=d['report'];button=r['close']
        r['tab']=tab
        assert abs(r['dialog']['bottom']-d['viewport']['visualHeight'])<=1,d
        assert abs(r['dialog']['top']-d['viewport']['offsetTop'])<=1,d
        assert button['width']>=44 and button['height']>=44,d
        assert button['top']>=safe_top-1 and button['bottom']<=d['viewport']['visualHeight']-safe_bottom+1,d
        assert r['closeHit'],d
        gap=r['app']['bottom']-r['lastDirectBottom']
        assert abs(gap-d['contentSafeBottom'])<=2,(gap,d)
        page.screenshot(path=str(out/(label+'-'+state+'-'+tab+'.png')))
        page.locator('[data-report-close]').click();ui.expect(page.locator('.lessonReportDialog')).not_to_be_visible()
        assert snapshot(page)==original,'Report changed original records, selected player, personal ROUND or archives'
        results.append({'tab':tab,'middle':middle,**d})
    return results

def run(page,source,url,out,case):
    results=[]
    for scenario in ['empty','plain','undo']:
        ui.fixture(page,source,url,scenario,count=2)
        if scenario=='undo':
            ui.open_putting(page,'TEST 선수 A')
            for selector in ['#lessonPuttHoled','#lessonPuttShort','#lessonPuttLong']:
                ui.assert_inside_viewport(page,selector)
                content_safe=page.evaluate('parseFloat(getComputedStyle(document.querySelector("#courseLessonDev")).getPropertyValue("--lesson-content-safe-bottom"))||0')
                assert page.locator(selector).bounding_box()['y']+page.locator(selector).bounding_box()['height']<=case['visualHeight']-content_safe+1
        d=play_geometry(page,case['safeBottom']);page.screenshot(path=str(out/(case['label']+'-'+scenario+'-play.png')))
        result={'state':scenario,'play':d,'reports':reports(page,case['safeTop'],case['safeBottom'],out,case['label'],scenario)};results.append(result)
    # Retraction gives space to the map and any previously clipped existing controls.
    ui.fixture(page,source,url,'empty',count=2);before=snapshot(page);small=play_geometry(page,case['safeBottom'])
    page.evaluate('h=>__lessonViewport.setHeight(h)',case['height']);frames(page);large=play_geometry(page,case['safeBottom'])
    delta=case['height']-case['visualHeight'];map_delta=large['map']['height']-small['map']['height'];panel_delta=large['panel']['height']-small['panel']['height']
    assert map_delta>=-1 and abs(map_delta+panel_delta-delta)<=2,(small,large,delta)
    if small['panelScroll']<=1 and small['panelPadding']==large['panelPadding']:
        assert abs(map_delta-delta)<=2,(small,large,delta)
    assert snapshot(page)==before
    options=sdk_options(page)
    return {'case':case,'states':results,'viewportGrowth':{'before':small,'after':large,'viewportDelta':delta,'actualMapDelta':map_delta,'actualPanelDelta':panel_delta},'existingMapOptions':options}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-iphone-layout');parser.add_argument('--baseline-json',default='');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    source=(ui.REPO/'course-lesson.js').read_text();files=['course-lesson.js','course-lesson.css','course-lesson-map.js','course-lesson-report.js','index.html','tests/course-lesson-iphone-layout.test.py'];hashes={f:hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest() for f in files};(out/'tested-source-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
    result={'environment':'Cloud Chromium; CSS env() response substitution plus matching safe-area variables; scale=1/offsetTop=0 visualViewport simulated; not physical iPhone/Safari or real Google SDK','runs':[]}
    if args.baseline_json:result['baseline']=json.loads(Path(args.baseline_json).read_text())
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for case in [{'width':390,'height':844,'visualHeight':730,'safeTop':59,'safeBottom':34,'label':'portrait-59-34'},{'width':844,'height':390,'visualHeight':330,'safeTop':47,'safeBottom':21,'label':'landscape-47-21'}]:
                context=browser.new_context(viewport={'width':case['width'],'height':case['height']});context.add_init_script(ui.INIT_SCRIPT);context.add_init_script('('+VIEWPORT+')('+json.dumps({'height':case['visualHeight'],'safeTop':case['safeTop'],'safeBottom':case['safeBottom']})+');');context.route('**/*',lambda route:gate(route,base,case));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                checks=run(page,source,base+'/?courseLesson=1',out,case);assert not errors,errors;result['runs'].append(checks);print(case['label']+': PASS',flush=True);context.close()
            browser.close()
        assert all(hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest()==h for f,h in hashes.items()),'Sources changed during regression'
        result['status']='PASS';print('PASS')
    finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');server.shutdown()

if __name__=='__main__':main()
