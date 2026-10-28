#!/usr/bin/env python3
"""Bottom gaps with simulated Safari/PWA viewports, not physical iPhone measurements."""
import argparse,functools,hashlib,http.server,importlib.util,json,re,threading
from pathlib import Path
from urllib.parse import urlparse

def load(name,file):
    s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

ui=load('bottom_ui','course-lesson-ui.test.py');maps=load('bottom_maps','course-lesson-map.test.py')
INIT=r"""config=>{
 const state={visualHeight:config.visualHeight,actualVisibleHeight:config.actualVisibleHeight,probeHeight:config.actualVisibleHeight},vv=new EventTarget();
 for(const [key,get] of Object.entries({height:()=>state.visualHeight,width:()=>innerWidth,offsetTop:()=>0,offsetLeft:()=>0,scale:()=>1}))Object.defineProperty(vv,key,{get});
 Object.defineProperty(window,'visualViewport',{get:()=>vv,configurable:true});
 const apply=()=>document.documentElement.style.setProperty('--bottom-test-probe-height',state.probeHeight+'px');
 window.__bottomViewport={state,set(value){Object.assign(state,value);apply();vv.dispatchEvent(new Event('resize'));vv.dispatchEvent(new Event('scroll'));}};
 const standalone=config.mode==='standalone',original=matchMedia.bind(window);
 window.matchMedia=query=>{if(!query.includes('display-mode'))return original(query);const m=new EventTarget();Object.defineProperties(m,{matches:{value:query.includes('standalone')&&standalone},media:{value:query}});m.addListener=fn=>m.addEventListener('change',fn);m.removeListener=fn=>m.removeEventListener('change',fn);return m;};
 Object.defineProperty(navigator,'standalone',{get:()=>standalone});
 const install=()=>{apply();const style=document.createElement('style');style.textContent='.lessonViewportMeasure{height:var(--bottom-test-probe-height)!important}';document.head.append(style);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}"""
MEASURE=r"""()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width};},visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 const panel=document.querySelector('#lessonShotPanel'),score=document.querySelector('#lessonPenaltyMeta'),p=rect(panel),last=Math.max(...[...panel.children].filter(visible).map(e=>e.getBoundingClientRect().bottom)),actual=__bottomViewport.state.actualVisibleHeight;
 const buttons=[...panel.querySelectorAll('button')].filter(visible).map(e=>({id:e.id,...rect(e)}));
 return {viewport:{layoutHeight:innerHeight,clientHeight:document.documentElement.clientHeight,visualHeight:visualViewport.height,actualVisibleHeight:actual,probeHeight:document.querySelector('.lessonViewportMeasure')?.getBoundingClientRect().height??null,standalone:matchMedia('(display-mode: standalone)').matches,navigatorStandalone:navigator.standalone},shell:rect(document.querySelector('#courseLessonDev')),header:rect(document.querySelector('.lessonHeader')),panel:p,map:rect(document.querySelector('.lessonMapHost')),score:rect(score),lastDirectBottom:last,lastButtonBottom:Math.max(...buttons.map(b=>b.bottom)),buttons,scoreToPanel:p.bottom-score.getBoundingClientRect().bottom,lastToPanel:p.bottom-last,panelToVisibleBottom:actual-p.bottom,panelPaddingBottom:parseFloat(getComputedStyle(panel).paddingBottom),panelScroll:panel.scrollTop,puttingPanelVisible:visible(document.querySelector('#lessonPutting'))};
}"""

def snapshot(page):
    return page.evaluate('''()=>({group:localStorage.getItem('jgi_course_lesson_group_v1'),personal:localStorage.getItem('agi_player_v1_round'),history:localStorage.getItem('jgi_completed_rounds_v1'),archive:localStorage.getItem('jgi_course_lesson_archive_v1'),round:JSON.stringify(round)})''')

def settle(page,recovery=False):
    maps.frames(page);maps.frames(page)
    if recovery:page.wait_for_timeout(300);maps.frames(page)

def capture(page):
    page.locator('#lessonShotPanel').evaluate('e=>e.scrollTop=e.scrollHeight');settle(page);return page.evaluate(MEASURE)

def assert_geometry(d,case):
    actual=d['viewport']['actualVisibleHeight'];safe=max(0,case['safeBottom']-(d['viewport']['clientHeight']-actual))
    assert abs(d['shell']['bottom']-actual)<=1 and abs(d['panelToVisibleBottom'])<=1,d
    assert abs(d['map']['bottom']-d['panel']['top'])<=1 and d['map']['height']>=79,d
    assert -1<=d['lastToPanel']<=max(2,safe)+4,d
    assert d['score']['top']>=d['panel']['top']-1 and d['score']['bottom']<=actual+1,d
    if safe>0:assert d['scoreToPanel']>=min(safe,d['score']['height'])-1,d
    assert d['lastButtonBottom']<=actual-safe+1,d
    assert all(b['height']>=44 and b['width']>=44 for b in d['buttons']),d
    if safe==0:assert d['panelPaddingBottom']<=2.5 and d['lastToPanel']<=4.5,d
    assert not d['puttingPanelVisible'],'ON GREEN must not force putting open'

def gate(route,base,case,frozen):
    path=urlparse(route.request.url).path;name='index.html' if path in ['/','/index.html'] else path.removeprefix('/')
    if route.request.url.startswith(base+'/') and name in frozen:
        body=re.sub(r'env\(safe-area-inset-(top|bottom|left|right)(?:\s*,\s*0px)?\)',lambda m:str({'top':case['safeTop'],'bottom':case['safeBottom'],'left':0,'right':0}[m[1]])+'px',frozen[name])
        route.fulfill(status=200,content_type='text/css' if name.endswith('.css') else 'text/html' if name.endswith('.html') else 'text/javascript',body=body)
    else:ui.gate(route,base)

def keyboard_recovery(page,case):
    before=snapshot(page);ui.click(page,'#lessonManageOpen');page.locator('#lessonName').focus()
    keyboard_height=400 if case['height']>500 else 180
    page.evaluate('value=>__bottomViewport.set(value)',{'probeHeight':case['height'],'visualHeight':keyboard_height,'actualVisibleHeight':keyboard_height});settle(page)
    keyboard=page.evaluate(MEASURE)
    assert abs(keyboard['shell']['bottom']-keyboard_height)<=1,'Focused keyboard must use the reduced visual viewport'
    assert keyboard['viewport']['probeHeight']==case['height']
    page.evaluate('value=>__bottomViewport.set(value)',{'probeHeight':case['height'],'visualHeight':600 if case['height']>500 else 250,'actualVisibleHeight':case['height']})
    page.locator('#lessonName').evaluate('e=>e.blur()');settle(page,True)
    recovered=page.evaluate(MEASURE);assert abs(recovered['shell']['bottom']-case['height'])<=1,recovered
    page.locator('#lessonManageClose').click();settle(page,True);after=capture(page);assert_geometry(after,case)
    assert snapshot(page)==before,'Keyboard focus/blur changed persisted records'
    return {'keyboard':keyboard,'afterBlur':recovered,'afterClose':after}

def run(page,source,url,out,case,baseline):
    states=[]
    for scenario in ['empty','plain','undo']:
        ui.fixture(page,source,url,scenario,count=2);page.evaluate(maps.FAKE,'VECTOR');settle(page);original=snapshot(page)
        ui.expect(page.locator('#lessonMapStatus')).not_to_be_visible();initial=capture(page);assert_geometry(initial,case)
        assert initial['viewport']['probeHeight']==case['actualVisibleHeight'],initial
        state={'state':scenario,'initial':initial}
        if baseline:
            previous=next(s['initial'] for s in baseline['states'] if s['state']==scenario);state['baseline']=previous
            assert initial['lastToPanel']<=previous['lastToPanel']+1,(previous,initial)
            assert initial['map']['height']>=previous['map']['height']-1,(previous,initial)
            if scenario!='plain' or case['actualVisibleHeight']<case['height']:
                assert initial['lastToPanel']<previous['lastToPanel']-1,(previous,initial)
        if case['phase']=='stale':
            page.evaluate("()=>document.dispatchEvent(new FocusEvent('focusout',{bubbles:true}))");settle(page,True);state['afterFocusout']=capture(page);assert_geometry(state['afterFocusout'],case)
            ui.click(page,'#lessonReportOpen');page.locator('[data-report-close]').click();settle(page,True);state['afterReportClose']=capture(page);assert_geometry(state['afterReportClose'],case)
            page.evaluate("()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");settle(page,True);state['afterPageShow']=capture(page);assert_geometry(state['afterPageShow'],case)
        if case['phase']=='fullscreen' and scenario=='empty':state['keyboardRecovery']=keyboard_recovery(page,case)
        assert snapshot(page)==original,'Viewport recovery changed original Group, personal ROUND or archives'
        page.screenshot(path=str(out/(case['label']+'-'+scenario+'.png')));states.append(state)
    return {'case':case,'states':states}

def cases():
    for orientation,w,h,top,bottom,normal,stale in [('portrait',390,844,59,34,730,600),('landscape',844,390,0,21,330,250)]:
        for mode in ['browser','standalone']:
            for phase,vh,actual in [('normal',normal,normal),('fullscreen',h,h),('stale',stale,h)]:
                yield {'label':orientation+'-'+mode+'-'+phase,'width':w,'height':h,'safeTop':top,'safeBottom':bottom,'visualHeight':vh,'actualVisibleHeight':actual,'mode':mode,'phase':phase}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-bottom-gap');parser.add_argument('--baseline-json',default='');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    frozen={f:(ui.REPO/f).read_text() for f in ['course-lesson.js','course-lesson.css','course-lesson-map.js','index.html']};files={**frozen,'tests/course-lesson-bottom-gap.test.py':Path(__file__).read_text()};hashes={f:hashlib.sha256(v.encode()).hexdigest() for f,v in files.items()};(out/'tested-source-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
    baseline=json.loads(Path(args.baseline_json).read_text()) if args.baseline_json else None
    result={'environment':'Cloud Chromium, synthetic two-player records, explicit existing-Map simulation. CSS env() and only the hidden 100dvh measurement probe are mocked consistently; browser/PWA and visualViewport are simulated, not physical Safari measurements.','runs':[]}
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for case in cases():
                context=browser.new_context(viewport={'width':case['width'],'height':case['height']});context.add_init_script(ui.INIT_SCRIPT);context.add_init_script('('+INIT+')('+json.dumps(case)+');');context.route('**/*',lambda route:gate(route,base,case,frozen));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                previous=next((r for r in baseline['runs'] if r['case']['label']==case['label']),None) if baseline else None
                checks=run(page,frozen['course-lesson.js'],base+'/?courseLesson=1',out,case,previous);assert not errors,errors;result['runs'].append(checks);(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(case['label']+': PASS',flush=True);context.close()
            browser.close()
        assert all(hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest()==v for f,v in hashes.items()),'Sources changed during regression'
        result['status']='PASS';print('PASS')
    finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');server.shutdown()

if __name__=='__main__':main()
