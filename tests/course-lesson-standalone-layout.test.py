#!/usr/bin/env python3
"""Home Screen viewport mismatch regression; modeled platforms, not physical Safari evidence."""
import argparse,functools,hashlib,http.server,importlib.util,json,threading
from pathlib import Path

def load(name,file):
    s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

bottom=load('standalone_bottom','course-lesson-bottom-gap.test.py');ui=bottom.ui;maps=bottom.maps
INIT=r"""config=>{
 const state={visualHeight:config.visualHeight,actualVisibleHeight:config.actualVisibleHeight,legacyDvh:config.legacyDvh,offsetTop:0,visibility:'visible'},vv=new EventTarget();
 for(const [key,get] of Object.entries({height:()=>state.visualHeight,width:()=>innerWidth,offsetTop:()=>state.offsetTop,offsetLeft:()=>0,scale:()=>1}))Object.defineProperty(vv,key,{get});
 Object.defineProperty(window,'visualViewport',{get:()=>vv,configurable:true});Object.defineProperty(document,'visibilityState',{get:()=>state.visibility,configurable:true});Object.defineProperty(document,'hidden',{get:()=>state.visibility==='hidden',configurable:true});
 const apply=()=>document.documentElement.style.setProperty('--standalone-test-dvh',state.legacyDvh+'px');
 window.__standalonePlatform={state,set(value){Object.assign(state,value);apply();vv.dispatchEvent(new Event('resize'));vv.dispatchEvent(new Event('scroll'));}};
 const original=matchMedia.bind(window);window.matchMedia=q=>{if(!q.includes('display-mode'))return original(q);const m=new EventTarget();Object.defineProperties(m,{matches:{value:q.includes('standalone')&&config.mediaStandalone},media:{value:q}});m.addListener=fn=>m.addEventListener('change',fn);m.removeListener=fn=>m.removeEventListener('change',fn);return m;};
 Object.defineProperty(navigator,'standalone',{get:()=>config.navStandalone,configurable:true});
 const install=()=>{apply();const style=document.createElement('style');style.textContent='.lessonViewportMeasure:not(.lessonStandaloneViewport){height:var(--standalone-test-dvh)!important}';document.head.append(style);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}"""
MEASURE=bottom.MEASURE.replace('__bottomViewport.state.actualVisibleHeight','__standalonePlatform.state.actualVisibleHeight').replace("return {viewport:","return {contentSafe:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lesson-content-safe-bottom'))||0,viewport:")
REPORT=r"""()=>{const d=document.querySelector('.lessonReportDialog[open]'),app=d.querySelector('.app'),content=d.querySelector('[data-report-content]'),visible=e=>e.getBoundingClientRect().height>0,active=[...content.children].find(visible),last=Math.max(...[...active.children].filter(visible).map(e=>e.getBoundingClientRect().bottom)),x=d.querySelector('[data-report-close]'),r=x.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),box=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width};};return {dialog:box(d),close:box(x),closeHit:!!hit&&(hit===x||x.contains(hit)),lastBlockToApp:app.getBoundingClientRect().bottom-last,contentSafe:parseFloat(getComputedStyle(d).getPropertyValue('--lesson-content-safe-bottom'))||0};}"""

def settle(page):bottom.settle(page,True)
def measure(page):
    page.locator('#lessonShotPanel').evaluate('e=>e.scrollTop=e.scrollHeight');bottom.settle(page);return page.evaluate(MEASURE)

def fixture(page,source,url,scenario,seeds):
    if scenario not in seeds:
        ui.fixture(page,source,url,scenario,count=2);seeds[scenario]=bottom.snapshot(page)
    else:
        page.goto(url,wait_until='domcontentloaded');page.wait_for_selector('#lessonPlayers',state='attached')
        page.evaluate('''s=>{const keys={group:'jgi_course_lesson_group_v1',personal:'agi_player_v1_round',history:'jgi_completed_rounds_v1',archive:'jgi_course_lesson_archive_v1'};for(const [name,key]of Object.entries(keys)){if(s[name]===null)localStorage.removeItem(key);else localStorage.setItem(key,s[name]);}}''',seeds[scenario]);page.reload(wait_until='domcontentloaded');ui.expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    page.evaluate(maps.FAKE,'VECTOR');settle(page)

def reports(page,case,strict,tabs):
    result=[];original=bottom.snapshot(page)
    for tab in tabs:
        ui.click(page,'#lessonReportOpen');page.locator('[data-report-tab="'+tab+'"]').click()
        page.locator('.lessonReportDialog').evaluate('e=>e.scrollTop=(e.scrollHeight-e.clientHeight)/2');bottom.settle(page);middle=page.evaluate(REPORT)
        page.locator('.lessonReportDialog').evaluate('e=>e.scrollTop=e.scrollHeight');bottom.settle(page);d=page.evaluate(REPORT)
        if strict:
            assert abs(d['dialog']['bottom']-case['actualVisibleHeight'])<=1,d
            assert d['close']['width']>=44 and d['close']['height']>=44 and d['close']['top']>=case['safeTop']-1,d
            assert d['closeHit'] and middle['closeHit'],(middle,d)
            safe=max(0,case['safeBottom']-(case['height']-case['actualVisibleHeight']))
            assert abs(d['lastBlockToApp']-safe)<=2,d
        result.append({'tab':tab,'middle':middle,'end':d});page.locator('[data-report-close]').click();settle(page);assert bottom.snapshot(page)==original
    return result

def recovery(page,case,strict):
    original=bottom.snapshot(page);result={};standalone=case['navStandalone'] or case['mediaStandalone']
    ui.click(page,'#lessonManageOpen');page.locator('#lessonName').focus();page.evaluate('s=>__standalonePlatform.set(s)',{'visualHeight':400 if case['height']>500 else 180,'actualVisibleHeight':440 if case['height']>500 else 220,'offsetTop':40});settle(page);result['keyboard']=page.evaluate(MEASURE)
    if strict:assert result['keyboard']['shell']['top']==40 and result['keyboard']['shell']['height']==(400 if case['height']>500 else 180),result
    page.evaluate('s=>__standalonePlatform.set(s)',{'visualHeight':600 if case['height']>500 else 250,'actualVisibleHeight':case['actualVisibleHeight'],'offsetTop':40});page.locator('#lessonName').evaluate('e=>e.blur()');settle(page);page.locator('#lessonManageClose').click();settle(page);result['afterBlur']=measure(page)
    page.evaluate("()=>{__standalonePlatform.set({visibility:'hidden'});document.dispatchEvent(new Event('visibilitychange'));__standalonePlatform.set({visibility:'visible'});document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}");settle(page);result['afterReentry']=measure(page)
    other={'width':844,'height':390,'legacyDvh':369 if standalone else 330,'actualVisibleHeight':390 if standalone else 330,'visualHeight':250 if standalone else 330} if case['height']>500 else {'width':390,'height':844,'legacyDvh':810 if standalone else 730,'actualVisibleHeight':844 if standalone else 730,'visualHeight':600 if standalone else 730}
    page.set_viewport_size({'width':other['width'],'height':other['height']});page.evaluate('s=>__standalonePlatform.set(s)',{k:v for k,v in other.items() if k not in ['width','height']});page.evaluate("()=>dispatchEvent(new Event('orientationchange'))");settle(page);result['rotated']=measure(page)
    if strict:
        assert abs(result['rotated']['shell']['bottom']-other['actualVisibleHeight'])<=1,result['rotated']
        for key in ['afterBlur','afterReentry']:
            assert result[key]['shell']['top']==0 and abs(result[key]['panelToVisibleBottom'])<=1,result[key]
    page.set_viewport_size({'width':case['width'],'height':case['height']});page.evaluate('s=>__standalonePlatform.set(s)',{'legacyDvh':case['legacyDvh'],'actualVisibleHeight':case['actualVisibleHeight'],'visualHeight':case['visualHeight'],'offsetTop':0});settle(page);result['returned']=measure(page)
    assert bottom.snapshot(page)==original,'Keyboard, close/re-entry or rotation changed stored records'
    return result

def cases():
    for orientation,w,h,top,safe,normal,legacy,stale in [('portrait',390,844,59,34,730,810,600),('landscape',844,390,0,21,330,369,250)]:
        for label,nav,media,vv in [('browser',False,False,normal),('nav-only',True,False,h),('media-only',False,True,h),('both-stale',True,True,stale)]:
            standalone=nav or media
            yield {'label':orientation+'-'+label,'width':w,'height':h,'safeTop':top,'safeBottom':safe,'navStandalone':nav,'mediaStandalone':media,'legacyDvh':legacy if standalone else normal,'visualHeight':vv,'actualVisibleHeight':h if standalone else normal}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-standalone-layout');parser.add_argument('--baseline-source',default='');parser.add_argument('--measure-only',action='store_true');parser.add_argument('--seed-file',default='');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    frozen={f:((Path(args.baseline_source)/f) if args.baseline_source and (Path(args.baseline_source)/f).exists() else ui.REPO/f).read_text() for f in ['course-lesson.js','course-lesson.css','course-lesson-map.js','index.html']};hashes={f:hashlib.sha256(s.encode()).hexdigest() for f,s in frozen.items()};(out/'served-source-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n');seeds=json.loads(Path(args.seed_file).read_text()) if args.seed_file else {}
    result={'environment':'Local cloud Chromium and synthetic records. Only legacy hidden CSS-dvh probe is modeled short; standalone fixed-inset probe uses native Chromium containing-block geometry. Platform flags/visualViewport are mocked; this is not a physical Safari measurement or confirmed iOS bug cause.','measureOnly':args.measure_only,'runs':[]}
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for case in cases():
                context=browser.new_context(viewport={'width':case['width'],'height':case['height']});context.add_init_script(ui.INIT_SCRIPT);context.add_init_script('('+INIT+')('+json.dumps(case)+');');context.route('**/*',lambda route:bottom.gate(route,base,case,frozen));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)));states=[]
                for scenario in ['empty','plain','undo']:
                    fixture(page,frozen['course-lesson.js'],base+'/?courseLesson=1',scenario,seeds);original=bottom.snapshot(page);d=measure(page)
                    if not args.measure_only:bottom.assert_geometry(d,case);assert d['viewport']['probeHeight']==case['actualVisibleHeight'],d
                    ui.click(page,'#lessonSatellite');bottom.settle(page);ui.click(page,'#lessonJgiMap');bottom.settle(page);assert page.evaluate('()=>__cameraMap.constructors')==0
                    state={'state':scenario,'initial':d,'reports':reports(page,case,not args.measure_only,['overviewScreen','performanceScreen','summaryScreen'] if scenario=='empty' else ['overviewScreen'])}
                    if scenario=='empty':state['recovery']=recovery(page,case,not args.measure_only)
                    if scenario=='plain':
                        ui.click(page,'#lessonOnGreen');ui.expect(page.locator('#lessonGreenDialog')).to_be_visible();ui.click(page,'#lessonGreenCancel');settle(page);state['afterGreenCancel']=measure(page)
                        for key in ['shell','panel','map']:assert state['afterGreenCancel'][key]==d[key],(key,d,state['afterGreenCancel'])
                    assert bottom.snapshot(page)==original;page.screenshot(path=str(out/(case['label']+'-'+scenario+'.png')));states.append(state)
                assert not errors,errors;result['runs'].append({'case':case,'states':states});(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');(out/'fixture-seeds.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n');print(case['label']+': '+('MEASURED' if args.measure_only else 'PASS'),flush=True);context.close()
            browser.close()
        if not args.baseline_source:assert all(hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest()==v for f,v in hashes.items()),'App source changed during regression'
        result['status']='MEASURED' if args.measure_only else 'PASS';print(result['status'])
    finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');(out/'fixture-seeds.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n');server.shutdown()

if __name__=='__main__':main()
