#!/usr/bin/env python3
"""Device-local Course Lesson finish/archive/report regressions; synthetic players only."""
import argparse, functools, hashlib, http.server, importlib.util, json, threading
from pathlib import Path

spec=importlib.util.spec_from_file_location('lesson_ui',Path(__file__).with_name('course-lesson-ui.test.py'))
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
ARCHIVE='jgi_course_lesson_archive_v1'

ADD_RECORDS=r"""source=>{
 const E=new Function('module',source+'\nreturn module.exports;')({exports:{}});
 let g=E.restoreGroup(localStorage),clock=1780000000000,n=200000;
 const services={now:()=>++clock,uuid:()=>String(++n)};
 const a=g.players[0].playerId,b=g.players[1].playerId;
 for(const [distance,result] of [['8','SHORT'],['1','HOLED']]){
  g=E.setPuttDistance(g,a,1,distance,services);const h=g.players[0].round.holes[0];
  g=E.recordPutt(g,a,1,h.puttsDetail.length+1,h.puttingReady.inputId,result,services);
 }
 g=E.recordPenalty(g,a,1,'clpen_archive_A','OB',1,services);
 g=E.selectPlayer(g,b);
 g=E.recordPenalty(g,b,1,'clpen_archive_B','HAZARD',2,services);
 g=E.selectPlayer(g,a);
 E.saveGroup(localStorage,g);return g;
}"""

def raw(page,key):
    return page.evaluate('key=>localStorage.getItem(key)',key)

def archives(page):
    payload=raw(page,ARCHIVE)
    if payload is None:return []
    value=json.loads(payload)
    assert value['version']==1 and isinstance(value['groups'],list)
    return value['groups']

def manage(page):
    if not page.locator('#lessonManageDialog').is_visible():ui.click(page,'#lessonManageOpen')

def finish_dialog(page):
    if not page.locator('#lessonFinishDialog').is_visible():
        manage(page);page.locator('#lessonFinishRound').click()
    ui.expect(page.locator('#lessonFinishDialog')).to_be_visible()

def close_finish(page):
    if page.locator('#lessonFinishDialog').is_visible():page.locator('#lessonFinishCancel').click()

def fixture(page,source,url):
    ui.fixture(page,source,url,'undo',count=2)
    page.evaluate('key=>localStorage.removeItem(key)',ARCHIVE)
    group=page.evaluate(ADD_RECORDS,source);page.reload(wait_until='domcontentloaded')
    ui.expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    return group,ui.personal_storage(page)

def archived_report(page,group,index):
    manage(page);player=group['players'][index]
    button=page.locator('#lessonArchiveList [data-archive-group="'+group['groupId']+'"][data-archive-player="'+player['playerId']+'"]')
    ui.expect(button).to_have_count(1);button.click()
    ui.expect(page.locator('#lessonReportTitle')).to_have_text(player['profile']['name']+' · REPORT')
    ui.expect(page.locator('#lessonReportStatus')).to_contain_text('중도 종료')
    ui.expect(page.locator('#lessonReportStatus')).to_contain_text(str(sum(h['completed'] for h in player['round']['holes']))+'/18홀 완료')
    ui.expect(page.locator('#lessonReport-ovPutts')).to_have_text(str(sum(h['putts'] for h in player['round']['holes'])))
    ui.expect(page.locator('#lessonReport-statPen')).to_have_text(str(sum(h['penalties'] for h in player['round']['holes'])))
    assert group['players'][1-index]['profile']['name'] not in page.locator('.lessonReportDialog').inner_text()
    assert page.locator('.lessonReportDialog').evaluate('el=>el.scrollWidth<=el.clientWidth+1')

def flow(page,source,url,out,label):
    group,personal=fixture(page,source,url);current=raw(page,ui.GROUP_KEY)
    # The sheet X and finish cancel both preserve the complete current group.
    manage(page);page.locator('#lessonManageClose').click()
    assert raw(page,ui.GROUP_KEY)==current and not archives(page)
    finish_dialog(page);page.locator('#lessonFinishCancel').click()
    assert raw(page,ui.GROUP_KEY)==current and not archives(page)
    # Starting a new group cannot silently replace a group with existing records.
    manage(page);page.locator('#lessonCreateGroup').click()
    assert raw(page,ui.GROUP_KEY)==current and not archives(page)
    finish_dialog(page);page.locator('#lessonFinishConfirm').evaluate('(el)=>{el.click();el.click();}')
    ui.expect(page.locator('#lessonFinishDialog')).not_to_be_visible()
    assert raw(page,ui.GROUP_KEY) is None
    saved=archives(page);assert len(saved)==1 and saved[0]['groupId']==group['groupId']
    assert saved[0]['endedAt']>0 and saved[0]['group']==group
    assert sum(h['completed'] for h in saved[0]['group']['players'][0]['round']['holes'])==1
    assert not any(h['completed'] for h in saved[0]['group']['players'][1]['round']['holes'])
    ui.expect(page.locator('#lessonFinishStatus')).to_be_visible()
    errors=page.locator('#lessonManageDialog [data-lesson-status][data-error="true"]')
    assert all(not errors.nth(i).is_visible() or not errors.nth(i).inner_text().strip() for i in range(errors.count())), 'Successful finish retained an obsolete error in the visible management sheet'
    page.screenshot(path=str(out/(label+'-finished.png')))
    # A retry of the original completed transaction is idempotent even after current-key removal.
    page.evaluate('''({source,group})=>{const E=new Function('module',source+'\\nreturn module.exports;')({exports:{}});E.finishGroup(localStorage,group,{now:()=>1780000000001});}''',{'source':source,'group':group})
    assert archives(page)==saved and raw(page,ui.GROUP_KEY) is None
    for index in [0,1]:
        archived_report(page,group,index);page.locator('[data-report-close]').click()
    # A new active group and a refresh leave both old individual snapshots accessible.
    manage(page);page.locator('#lessonPlayerCount').select_option('1');page.locator('#lessonCreateGroup').click()
    active=ui.storage_group(page);assert active['groupId']!=group['groupId']
    page.locator('#lessonName').fill('TEST 새 선수 C');page.locator('#lessonContact').fill('')
    page.locator('#lessonSex').select_option('MALE');page.locator('#lessonHandicap').fill('7');page.locator('#lessonTee').select_option('White')
    page.locator('#lessonRegisterPlayer').click();active=raw(page,ui.GROUP_KEY)
    assert archives(page)==saved
    for index in [1,0]:
        archived_report(page,group,index);page.screenshot(path=str(out/(label+'-archive-'+str(index)+'.png')));page.locator('[data-report-close]').click()
        assert raw(page,ui.GROUP_KEY)==active and archives(page)==saved
    page.reload(wait_until='domcontentloaded')
    assert raw(page,ui.GROUP_KEY)==active and archives(page)==saved
    page.context.set_offline(True)
    try:
        for index in [0,1]:
            archived_report(page,group,index);page.locator('[data-report-close]').click()
    finally:page.context.set_offline(False)
    ui.assert_personal(page,personal)
    return {'cancel_and_X':'PASS','no_silent_new_group':'PASS','partial_holes_unchanged':'PASS','A_B_archive_reports_new_group_refresh_offline':'PASS','double_finish_idempotent':'PASS','personal_round_unchanged':'PASS'}

def failures(page,source,url):
    group,personal=fixture(page,source,url);current=raw(page,ui.GROUP_KEY)
    for operation,key in [('setItem',ARCHIVE),('removeItem',ui.GROUP_KEY)]:
        finish_dialog(page)
        page.evaluate('''({operation,key})=>{const original=Storage.prototype[operation];window.__restoreArchiveStorage=()=>{Storage.prototype[operation]=original;};Storage.prototype[operation]=function(k,...args){if(k===key)throw new DOMException('TEST_ARCHIVE_STORAGE_FAILURE','QuotaExceededError');return original.call(this,k,...args);};}''',{'operation':operation,'key':key})
        try:page.locator('#lessonFinishConfirm').click()
        finally:page.evaluate('()=>__restoreArchiveStorage()')
        assert raw(page,ui.GROUP_KEY)==current
        if operation=='setItem':assert not archives(page)
        else:assert len(archives(page))==1 and archives(page)[0]['group']==group
        close_finish(page)
        ui.expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    finish_dialog(page);page.locator('#lessonFinishConfirm').click()
    assert raw(page,ui.GROUP_KEY) is None and len(archives(page))==1
    assert archives(page)[0]['group']==group
    ui.assert_personal(page,personal)
    return {'archive_write_failure_preserves_active':'PASS','active_remove_failure_verified_backup_retry_no_duplicate':'PASS'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/jgi-lesson-archive');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    source=(ui.REPO/'course-lesson.js').read_text();files=['course-lesson.js','course-lesson-report.js','course-lesson-summary.js','course-lesson.css','tests/course-lesson-archive.test.py']
    hashes={f:hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest() for f in files};(out/'tested-source-sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(ui.SafeHandler,directory=str(ui.REPO)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1]);result={'environment':'Local cloud Chromium; synthetic players; external/API requests blocked; not physical Safari','runs':[]}
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for w,h,label in [(390,844,'iphone'),(844,390,'iphone-landscape'),(820,1180,'ipad'),(1180,820,'ipad-landscape')]:
                context=browser.new_context(viewport={'width':w,'height':h});context.add_init_script(ui.INIT_SCRIPT);context.route('**/*',lambda route:ui.gate(route,base));page=context.new_page();page.set_default_timeout(20000);page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                checks=flow(page,source,base+'/?courseLesson=1',out,label);checks.update(failures(page,source,base+'/?courseLesson=1'));assert not errors,errors
                result['runs'].append({'viewport':[w,h],'checks':checks,'page_errors':errors});print(label+': PASS',flush=True);context.close()
            browser.close()
        assert all(hashlib.sha256((ui.REPO/f).read_bytes()).hexdigest()==v for f,v in hashes.items()),'Sources changed during regression'
        result['status']='PASS';print('PASS')
    finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');server.shutdown()

if __name__=='__main__':main()
