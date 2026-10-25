#!/usr/bin/env python3
"""Local-only Course Lesson UI regression/screenshot harness.

Run: python tests/course-lesson-ui.test.py [--repo /path/to/read-only/source] [--out /tmp/results]

Uses the installed Python Playwright and /usr/bin/chromium. No dependency install,
network API calls, real Google SDK, secrets, or customer records. Repository files
are served read-only. runtime-config.js is replaced with an empty key response.
"""
import argparse
import functools
import http.server
import json
import re
import tempfile
from pathlib import Path
import threading
from urllib.parse import urlparse, unquote

from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parents[1]
GROUP_KEY = 'jgi_course_lesson_group_v1'
PLAYER_KEYS = ['agi_player_v1_round', 'jgi_completed_rounds_v1']


class SafeHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        parts = Path(path).parts
        if any(p.startswith('.') for p in parts if p not in ['/', '.']) or path.startswith(('/api/', '/lib/', '/node_modules/')):
            self.send_error(404)
            return
        if path == '/runtime-config.js':
            data = b'window.JGI_RUNTIME_CONFIG={googleMapsBrowserKey:""};'
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


INIT_SCRIPT = r"""
(() => {
  window.__jgiGpsRequests = [];
  Object.defineProperty(navigator, 'geolocation', {value: {
    getCurrentPosition(success, error, options) {window.__jgiGpsRequests.push({success,error,options});},
    watchPosition() {return 1;}, clearWatch() {}
  }, configurable:true});
})();
"""

FIXTURE_SCRIPT = r"""({source, count, scenario}) => {
  const module={exports:{}};
  const E=new Function('module',source+'\nreturn module.exports;')(module);
  let seq=0, clock=1770000000000;
  const point=(lat,lng)=>({lat,lng,accuracy:null,time:++clock,source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
  const geometry=(r,hole)=>{
    const data=activeCourseData(r),h=data.holes[String(hole)];
    return {hole,holeId:h.i??h.id??null,courseId:data.courseId??null,geometryVersion:data.version||r.courseVersion,
      polygons:courseShapes(h,r).filter(s=>s.type==='GREEN'&&!s.line&&s.path.length>=3).map(s=>s.path)};
  };
  const services={uuid:()=>String(++seq),now:()=>++clock,
    benchmark:r=>sgBenchmarkInfo(r),hydrate:r=>hydrateRoundCourseTruth(r),
    courseVersion:window.JGI_OLD_COURSE_DATA?.version||null,dataVersion:window.JGI_SG_BENCHMARK_DATA?.version,
    clubs:DEFAULT_MASTER_CLUBS.filter(c=>c.name!=='Putter').map(c=>c.name),
    distance:(a,b)=>hav(a,b),greenGeometry:geometry,
    shotContext:r=>({holeId:activeCourseData(r).holes[String(r.currentHole)].i??null,courseId:activeCourseData(r).courseId??null})};
  let g=E.createGroup(count,services);
  for(const [i,p] of g.players.entries())g=E.registerPlayer(g,p.playerId,
    {name:'TEST 선수 '+String.fromCharCode(65+i),contact:'TEST-WA-00'+(i+1),sex:i%2?'MALE':'FEMALE',handicap:String(i+5),tee:i%2?'Blue':'Red'},services);
  if(scenario==='par3'){
    const hole=g.players[0].round.holes.find(h=>h.par===3&&activeCourseData(g.players[0].round).holes[String(h.hole)]?.g)?.hole;
    if(!hole)throw Error('No actual PAR3 hole available');
    for(const p of g.players)g=E.chooseHole(g,p.playerId,hole);
  }
  const physical=(pid,offset=0)=>{
    const p=g.players.find(p=>p.playerId===pid),h=activeCourseData(p.round).holes[String(p.round.currentHole)];
    const t=h.t||h.g;
    g=E.recordShot(E.confirmPosition(E.stagePosition(g,pid,point(t[0]+offset,t[1]+offset)),pid,services),pid,services);
  };
  const inside=(p)=>{
    const geo=geometry(p.round,p.round.currentHole),pts=geo.polygons.flat(),
      minLat=Math.min(...pts.map(x=>x.lat)),maxLat=Math.max(...pts.map(x=>x.lat)),
      minLng=Math.min(...pts.map(x=>x.lng)),maxLng=Math.max(...pts.map(x=>x.lng));
    const order=Array.from({length:19},(_,i)=>i+1).sort((a,b)=>Math.abs(a-10)-Math.abs(b-10));
    for(const yi of order)for(const xi of order){
      const q=point(minLat+(maxLat-minLat)*yi/20,minLng+(maxLng-minLng)*xi/20);
      if(E.pointInGreen(q,geo))return q;
    }
    throw Error('No synthetic test point within actual GI green');
  };
  const green=(pid)=>{const p=g.players.find(p=>p.playerId===pid);g=E.onGreen(g,pid,p.round.holes[p.round.currentHole-1].shots.at(-1).id,inside(p),null,services);};
  const holed=(pid)=>{const p=g.players.find(p=>p.playerId===pid);g=E.holed(g,pid,p.round.holes[p.round.currentHole-1].shots.at(-1).id,services);};
  if(scenario!=='empty')for(const p of g.players)physical(p.playerId);
  if(scenario==='mixed'){
    green(g.players[1].playerId);
    g=E.selectPlayer(g,g.players[1].playerId);
    g=E.setPuttDistance(g,g.players[1].playerId,1,'8',services);
    holed(g.players[2].playerId);
  }else if(scenario==='undo'){
    for(let i=0;i<3;i++)physical(g.players[0].playerId,(i+1)*0.00001);
    green(g.players[0].playerId);
  }else if(scenario==='auto'){
    for(const p of g.players.slice(0,-1))holed(p.playerId);
  }
  g=E.selectPlayer(g,scenario==='auto'?g.players.at(-1).playerId:g.players[0].playerId);
  E.validateGroup(g);
  localStorage.setItem(E.STORAGE,JSON.stringify(g));
  // A valid personal Round sentinel avoids intentionally corrupting the Player app.
  const personal=emptyRound('Jagorawi Golf & Country Club','Old Course');
  personal.playerName='TEST PERSONAL ROUND SENTINEL';
  localStorage.setItem('agi_player_v1_round',JSON.stringify(personal));
  localStorage.setItem('jgi_completed_rounds_v1','[]');
  const hole=g.players[0].round.currentHole,gp=inside(g.players[0]),geo=geometry(g.players[0].round,hole);
  let gp2=point(gp.lat+0.000005,gp.lng+0.000005);
  if(!E.pointInGreen(gp2,geo))gp2=point(gp.lat-0.000005,gp.lng-0.000005);
  if(!E.pointInGreen(gp2,geo))throw Error('No second synthetic Green point');
  return {group:g,greenPoint:gp,greenPoint2:gp2,hole};
}"""


def storage_group(page):
    return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', GROUP_KEY)


def personal_storage(page):
    return page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))', PLAYER_KEYS)


def selected(group):
    return next(p for p in group['players'] if p['playerId'] == group['selectedPlayerId'])


def reveal(page, selector):
    """Use real panel buttons/details; never override CSS or hidden state."""
    loc = page.locator(selector)
    # Close auxiliary panels through their real controls before reaching the cockpit.
    for dialog_id,close_id in [('lessonManageDialog','lessonManageClose'),('lessonHistoryDialog','lessonHistoryClose'),('lessonClubDialog','lessonClubClose'),('lessonPenaltyDialog','lessonPenaltyClose')]:
        dialog=page.locator('#'+dialog_id)
        if dialog.count() and dialog.is_visible() and not loc.evaluate('(el,id)=>!!el.closest("#"+id)',dialog_id):
            page.locator('#'+close_id).click()
    if loc.is_visible():
        return loc
    details = loc.locator('xpath=ancestor::details[not(@open)][1]')
    if details.count():
        details.locator(':scope > summary').click()
    if loc.is_visible():
        return loc
    navigation={
      'lessonManageDialog':'lessonManageOpen',
      'lessonHistoryDialog':'lessonHistoryOpen',
      'lessonClubDialog':'lessonClubOpen',
      'lessonPenaltyDialog':'lessonPenaltyOpen',
      'lessonPutting':'lessonPuttingToggle',
    }
    for panel_id,trigger_id in navigation.items():
        if loc.evaluate('(el,id)=>!!el.closest("#"+id)',panel_id):
            trigger=page.locator('#'+trigger_id)
            if trigger.count() and trigger.is_visible():
                trigger.click()
                if loc.is_visible():
                    return loc
    # Root may expose panels by aria-controls; this works with ordinary tab/dialog UI.
    for panel_id in loc.evaluate('(el)=>{let ids=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.id)ids.push(p.id);return ids;}'):
        trigger=page.locator(f'[aria-controls="{panel_id}"]')
        for i in range(trigger.count()):
            button=trigger.nth(i)
            if button.is_visible():
                button.click()
                if loc.is_visible():
                    return loc
    raise AssertionError(f'No actual visible UI access path found for {selector}')


def click(page, selector):
    reveal(page, selector).click()


def select_player(page, group, index):
    pid=group['players'][index]['playerId']
    click(page, f'#lessonPlayers [data-player-id="{pid}"]')
    expect(page.locator(f'#lessonPlayers [data-player-id="{pid}"]')).to_have_attribute('aria-pressed','true')
    assert selected(storage_group(page))['playerId']==pid


def assert_inside_viewport(page, selector, minimum=44):
    loc=reveal(page,selector)
    loc.scroll_into_view_if_needed()
    boxes=loc.evaluate('''el=>{const r=el.getBoundingClientRect(), x=r.x+r.width/2,y=r.y+r.height/2,
      hit=document.elementFromPoint(x,y);return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,
      unobscured:!!hit&&(hit===el||el.contains(hit)),tag:hit?.tagName,id:hit?.id};}''')
    assert boxes['x']>=-1 and boxes['x']+boxes['w']<=boxes['vw']+1, (selector,boxes)
    assert boxes['y']>=-1 and boxes['y']+boxes['h']<=boxes['vh']+1, (selector,boxes)
    assert boxes['w']>=minimum and boxes['h']>=minimum, (selector,boxes)
    assert boxes['unobscured'], (selector,boxes)


def assert_map_tee_green_reachable(page):
    observations=page.evaluate(r'''() => {
      const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),
        selected=g.players.find(p=>p.playerId===g.selectedPlayerId),r=selected.round,hole=r.currentHole,
        h=activeCourseData(r).holes[String(hole)],
        positions=g.players.map(p=>{
          if(!p.registered||p.round.currentHole!==hole)return null;
          const holeData=p.round.holes[hole-1],last=holeData.shots.at(-1),d=p.shotDraft;
          return d?.hole===hole&&d.confirmed?d.position:holeData.puttingReady?.ballPosition||last?.end||last?.start||null;
        }).filter(Boolean);
      if(selected.shotDraft?.hole===hole&&selected.shotDraft.position)positions.push(selected.shotDraft.position);
      const projector=courseViewProjector(h,r,positions),svg=document.querySelector('#lessonCourseSvg');
      return [['Tee',h.t],['Green',h.g]].map(([name,p])=>{
        const q=projector.project({lat:p[0],lng:p[1]}),sp=svg.createSVGPoint();sp.x=q.x;sp.y=q.y;
        const screen=sp.matrixTransform(svg.getScreenCTM()),hit=document.elementFromPoint(screen.x,screen.y);
        return {name,x:screen.x,y:screen.y,unobscured:!!hit&&(hit===svg||svg.contains(hit)),
          inside:screen.x>=0&&screen.y>=0&&screen.x<innerWidth&&screen.y<innerHeight,hit:hit?.id||hit?.tagName};
      });
    }''')
    assert all(p['unobscured'] and p['inside'] for p in observations),observations
    return observations


def green_click(page, point):
    xy=page.evaluate(r'''p=>{
      const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),
        r=g.players.find(p=>p.playerId===g.selectedPlayerId).round,
        ch=activeCourseData(r).holes[String(r.currentHole)],
        pts=courseShapes(ch,r).filter(s=>s.type==='GREEN'&&!s.line&&s.path.length>=3).flatMap(s=>s.path),
        local=courseLocalProjector(pts[0]),all=pts.map(local.toXY),q=local.toXY(p),
        minX=Math.min(...all.map(x=>x.x)),maxX=Math.max(...all.map(x=>x.x)),
        minY=Math.min(...all.map(x=>x.y)),maxY=Math.max(...all.map(x=>x.y)),
        scale=Math.min(336/Math.max(maxX-minX,1),436/Math.max(maxY-minY,1)),
        svg=document.querySelector('#lessonGreenSvg'),sp=svg.createSVGPoint();
      sp.x=200+(q.x-(minX+maxX)/2)*scale;sp.y=250-(q.y-(minY+maxY)/2)*scale;
      const screen=sp.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y};
    }''',point)
    page.mouse.click(xy['x'],xy['y'])


def putt_diagram_click(page,x,y):
    svg=reveal(page,'#lessonPuttGreen')
    svg.scroll_into_view_if_needed()
    xy=svg.evaluate('''(svg,p)=>{const q=svg.createSVGPoint();q.x=p.x;q.y=p.y;
      const screen=q.matrixTransform(svg.getScreenCTM()),r=svg.getBoundingClientRect();return {x:screen.x-r.x,y:screen.y-r.y};}''',{'x':x,'y':y})
    # Scroll the actual target point into nested panels, then perform an ordinary hit-tested click.
    svg.click(position=xy)


def main_map_click(page,point):
    """Hit-test an actual GI map point through the same existing projector."""
    svg=reveal(page,'#lessonCourseSvg')
    xy=svg.evaluate(r'''(svg,point)=>{
      const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),
        p=g.players.find(p=>p.playerId===g.selectedPlayerId),r=p.round,hole=r.currentHole,
        h=activeCourseData(r).holes[String(hole)],positions=g.players.map(player=>{
          if(!player.registered||player.round.currentHole!==hole)return null;
          const data=player.round.holes[hole-1],last=data.shots.at(-1),draft=player.shotDraft;
          return draft?.hole===hole&&draft.confirmed?draft.position:data.puttingReady?.ballPosition||last?.end||last?.start||null;
        }).filter(Boolean);
      if(p.shotDraft?.hole===hole&&p.shotDraft.position)positions.push(p.shotDraft.position);
      const q=courseViewProjector(h,r,positions).project(point),sp=svg.createSVGPoint();sp.x=q.x;sp.y=q.y;
      const screen=sp.matrixTransform(svg.getScreenCTM()),rect=svg.getBoundingClientRect();
      return {x:screen.x-rect.x,y:screen.y-rect.y};
    }''',point)
    svg.click(position=xy)


def displayed_metres(page,value):
    return page.evaluate('n=>Math.round(n)+"m"',value)


def fixture(page, source, url, scenario, count=4):
    page.goto(url,wait_until='domcontentloaded')
    page.wait_for_selector('#lessonPlayers',state='attached')
    data=page.evaluate(FIXTURE_SCRIPT,{'source':source,'count':count,'scenario':scenario})
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(count)
    return data,personal_storage(page)


def assert_personal(page,before):
    assert personal_storage(page)==before, 'Course Lesson changed personal Round/history storage'


def mixed_flow(page, source, url, out, label):
    data,personal=fixture(page,source,url,'mixed')
    group=data['group']
    select_player(page,group,0)
    expect(page.locator('#lessonShotPlayer')).to_contain_text('TEST 선수 A')
    assert page.locator('#lessonShotSave').is_disabled()
    # New club panel must still write the existing per-player draft through real UI.
    club_open=page.locator('#lessonClubOpen')
    if club_open.count():
        click(page,'#lessonClubOpen')
        clubs=page.locator('#lessonClubDialog .allClubBtn[data-club]')
        assert clubs.count()>1
        name=clubs.nth(1).get_attribute('data-club')
        clubs.nth(1).click()
        assert selected(storage_group(page))['shotDraft']['club']==name
        if page.locator('#lessonClubDialog').is_visible():
            click(page,'#lessonClubClose')
    for selector in ['#lessonPlayers [data-player-id="'+group['players'][0]['playerId']+'"]','#lessonOnGreen']:
        assert_inside_viewport(page,selector)
    page.screenshot(path=str(out/f'lesson-{label}-shot.png'),full_page=False)
    map_points=assert_map_tee_green_reachable(page)
    # Profile edit/registration fields remain reachable in the management panel.
    reveal(page,'#lessonName')
    expect(page.locator('#lessonName')).to_have_value('TEST 선수 A')
    for field in ['#lessonContact','#lessonSex','#lessonHandicap','#lessonTee','#lessonRegisterPlayer','#lessonSaveGroup','#lessonRestoreGroup']:
        assert page.locator(field).is_visible(),field
    if page.locator('#lessonManageDialog').count() and page.locator('#lessonManageDialog').is_visible():
        click(page,'#lessonManageClose')
    select_player(page,group,1)
    expect(reveal(page,'#lessonPuttDistanceInput')).to_have_value('8')
    expect(page.locator('#lessonPuttTitle')).to_contain_text('TEST 선수 B')
    reveal(page,'#lessonPuttDistanceInput').fill('7.5')
    select_player(page,group,2)
    expect(page.locator('#lessonHoleState')).to_contain_text('HOLED')
    select_player(page,group,1)
    expect(reveal(page,'#lessonPuttDistanceInput')).to_have_value('7.5')
    assert_inside_viewport(page,'#lessonPuttShort')
    page.screenshot(path=str(out/f'lesson-{label}-putting.png'),full_page=False)
    before=storage_group(page)
    click(page,'#lessonPuttShort')
    after=storage_group(page)
    b=after['players'][1]['round']['holes'][0]
    assert b['putts']==1 and b['puttsDetail'][0]['distanceM']==7.5 and b['puttsDetail'][0]['result']=='SHORT'
    assert b['score']==2
    for i in [0,2,3]:
        assert after['players'][i]==before['players'][i], 'Another player changed while B putted'
    # Downstream putts must retain the existing cancellation safety blocks.
    reveal(page,'#lessonUndoShot')
    expect(page.locator('#lessonUndoShot')).to_be_disabled()
    expect(page.locator('#lessonCancelResult')).to_be_disabled()
    expect(page.locator('#lessonCancelInfo')).to_contain_text('후속 기록')
    reveal(page,'#lessonPuttDistanceInput').fill('1')
    click(page,'#lessonPuttHoled')
    b=storage_group(page)['players'][1]['round']['holes'][0]
    assert b['completed'] and b['score']==3 and b['putts']==2
    assert selected(storage_group(page))['playerId']==group['players'][1]['playerId']
    # Exact persisted JSON survives a fresh boot (no Group re-registration).
    before_raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(4)
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_raw
    assert_personal(page,personal)
    # Diagnostics must remain reachable through the management panel.
    diagnostic=reveal(page,'#lessonMapDiagnostics')
    if not diagnostic.evaluate('(el)=>el.open'):
        diagnostic.locator(':scope > summary').click()
    expect(page.locator('#lessonMapDiagnosticText')).to_contain_text('hostname:')
    return {'mixed_player_switch_putting_score_restore':'PASS','shot_map_Tee_Green_hit_test':map_points}


def undo_green_flow(page,source,url,out,label):
    data,personal=fixture(page,source,url,'undo')
    original=storage_group(page)
    click(page,'#lessonUndoShot')
    after=storage_group(page)
    assert len(after['players'][0]['round']['holes'][0]['shots'])==3
    assert after['players'][1:]==original['players'][1:]
    # Existing history interaction selects Shot3, then opens its fixed-target Green Popup.
    rows=reveal(page,'#lessonShotHistory').locator('button')
    expect(rows).to_have_count(3)
    rows.nth(2).click()
    click(page,'#lessonOnGreen')
    expect(page.locator('#lessonGreenDialog')).to_be_visible()
    expect(page.locator('#lessonGreenTitle')).to_contain_text('TEST 선수 A')
    expect(page.locator('#lessonGreenTitle')).to_contain_text('Shot 3')
    blocked_before=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.evaluate('''pid=>document.querySelector('#lessonPlayers [data-player-id="'+pid+'"]').click()''',original['players'][1]['playerId'])
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==blocked_before
    expect(page.locator('#lessonGreenStatus')).to_contain_text('선수 전환 차단')
    green_click(page,data['greenPoint'])
    expect(page.locator('#lessonGreenSave')).to_be_enabled()
    assert_inside_viewport(page,'#lessonGreenSave')
    page.screenshot(path=str(out/f'lesson-{label}-green.png'),full_page=False)
    before_cancel=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    click(page,'#lessonGreenCancel')
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_cancel
    click(page,'#lessonOnGreen')
    green_click(page,data['greenPoint'])
    click(page,'#lessonGreenBall')
    green_click(page,data['greenPoint2'])
    click(page,'#lessonGreenPin')
    green_click(page,data['greenPoint'])
    click(page,'#lessonGreenSave')
    expect(page.locator('#lessonGreenDialog')).not_to_be_visible()
    g=storage_group(page);h=g['players'][0]['round']['holes'][0]
    assert len(h['shots'])==3 and h['shots'][2]['result']['type']=='ON_GREEN'
    # Browser pointer coordinates may be rounded to a CSS pixel, so allow ~0.2m.
    assert abs(h['shots'][2]['end']['lat']-data['greenPoint2']['lat'])<2e-6,(h['shots'][2]['end'],data['greenPoint2'])
    assert abs(h['shots'][2]['end']['lat']-data['greenPoint']['lat'])>1e-6
    assert abs(g['holePins']['1']['lat']-data['greenPoint']['lat'])<2e-6
    pin=g['holePins']['1']
    click(page,'#lessonCancelResult')
    cancelled=storage_group(page);h=cancelled['players'][0]['round']['holes'][0]
    assert len(h['shots'])==3 and h.get('puttingReady') is None and not h.get('completed')
    assert cancelled['holePins']['1']==pin
    # OFFLINE: one confirmed shot remains an immediate local write.
    page.context.set_offline(True)
    try:
        click(page,'#lessonGetGps')
        page.evaluate('''() => {const q=window.__jgiGpsRequests.pop();if(!q)throw Error('No GPS request');
          q.success({coords:{latitude:-6.4555,longitude:106.8825,accuracy:6},timestamp:Date.now()});}''')
        click(page,'#lessonConfirmPosition')
        click(page,'#lessonShotSave')
        assert len(storage_group(page)['players'][0]['round']['holes'][0]['shots'])==4
    finally:
        page.context.set_offline(False)
    assert_personal(page,personal)
    return {'undo_history_green_cancel_offline_shot':'PASS'}


def gps_ownership_flow(page,source,url):
    data,personal=fixture(page,source,url,'plain')
    group=storage_group(page)
    before_b=group['players'][1]
    click(page,'#lessonGetGps')
    select_player(page,group,1)
    page.evaluate('''() => {const q=window.__jgiGpsRequests.pop();if(!q)throw Error('No GPS request');
      q.success({coords:{latitude:-6.4556,longitude:106.8826,accuracy:5},timestamp:Date.now()});}''')
    after=storage_group(page)
    assert after['players'][1]==before_b, 'A GPS request modified B'
    a=after['players'][0]
    # Existing implementation stages to the requested A; an explicit stale-selection rejection is also safe.
    pos=a.get('shotDraft',{}).get('position')
    if pos:
        assert pos['source']=='GPS' and not a['shotDraft']['confirmed']
    assert after['selectedPlayerId']==group['players'][1]['playerId']
    assert_personal(page,personal)
    return {'delayed_gps_player_ownership':'PASS','delayed_gps_staged':bool(pos)}


def auto_next_flow(page,source,url):
    data,personal=fixture(page,source,url,'auto')
    before=storage_group(page)
    pid=before['selectedPlayerId']
    click(page,'#lessonHoled')
    after=storage_group(page)
    assert after['selectedPlayerId']==pid
    assert all(p['round']['currentHole']==2 for p in after['players'])
    assert all(p['round']['holes'][0]['completed'] for p in after['players'])
    assert all(not p['round']['holes'][1]['shots'] for p in after['players'])
    expect(page.locator('#lessonCourseSvg')).to_have_attribute('data-hole','2')
    expect(page.locator('#lessonStatus')).to_contain_text('HOLE 1 COMPLETE')
    assert_personal(page,personal)
    return {'all_player_auto_next_selected_player_retained':'PASS'}


def putting_collapsed(page):
    """Ready is persisted state; opening its input is an explicit scorer action."""
    expect(page.locator('#lessonPutting')).not_to_be_visible()
    expect(page.locator('#lessonPuttingToggle')).to_be_visible()
    expect(page.locator('#lessonPuttingToggle')).to_have_attribute('aria-expanded','false')


def open_putting(page,name):
    putting_collapsed(page)
    click(page,'#lessonPuttingToggle')
    expect(page.locator('#lessonPutting')).to_be_visible()
    expect(page.locator('#lessonPuttingToggle')).to_have_attribute('aria-expanded','true')
    expect(page.locator('#lessonPuttTitle')).to_contain_text(name)


def hole_for(group,index,hole):
    return group['players'][index]['round']['holes'][hole-1]


def on_green_ui(page,point,index,hole):
    click(page,'#lessonOnGreen')
    green_click(page,point)
    click(page,'#lessonGreenSkipPin')
    click(page,'#lessonGreenSave')
    expect(page.locator('#lessonGreenDialog')).not_to_be_visible()
    putting_collapsed(page)
    state=hole_for(storage_group(page),index,hole)
    assert len(state['shots'])==1 and state['shots'][0]['result']['type']=='ON_GREEN'
    assert state['putts']==0 and state['puttsDetail']==[] and not state['completed']
    return state


def marker_attributes(page):
    expect(page.locator('#lessonPuttBall')).to_have_attribute('visibility','visible')
    expect(page.locator('#lessonPuttLine')).to_have_attribute('visibility','visible')
    return page.evaluate('''()=>({
      ball:['cx','cy'].map(k=>document.querySelector('#lessonPuttBall').getAttribute(k)),
      line:['x1','y1','x2','y2'].map(k=>document.querySelector('#lessonPuttLine').getAttribute(k))
    })''')


def explicit_putting_free_order_flow(page,source,url,out,label):
    """Actual PAR3: A ON GREEN -> B ON GREEN -> B putt -> A putt."""
    data,personal=fixture(page,source,url,'par3',count=2)
    group=data['group'];hole=data['hole']
    assert hole_for(group,0,hole)['par']==3
    on_green_ui(page,data['greenPoint'],0,hole)
    ready_a=storage_group(page)['players'][0]
    page.screenshot(path=str(out/f'lesson-{label}-par3-on-green-ready.png'),full_page=False)
    select_player(page,group,1)
    assert storage_group(page)['players'][0]==ready_a
    on_green_ui(page,data['greenPoint2'],1,hole)
    assert storage_group(page)['players'][0]==ready_a

    open_putting(page,'TEST 선수 B')
    putt_diagram_click(page,250,180)
    b_marker=marker_attributes(page)
    reveal(page,'#lessonPuttDistanceInput').fill('8.0')
    select_player(page,group,0)
    open_putting(page,'TEST 선수 A')
    putt_diagram_click(page,180,250)
    a_marker=marker_attributes(page)
    assert a_marker!=b_marker
    reveal(page,'#lessonPuttDistanceInput').fill('1.5')
    select_player(page,group,1)
    open_putting(page,'TEST 선수 B')
    assert float(page.locator('#lessonPuttDistanceInput').input_value())==8
    assert marker_attributes(page)==b_marker
    select_player(page,group,0)
    open_putting(page,'TEST 선수 A')
    assert float(page.locator('#lessonPuttDistanceInput').input_value())==1.5
    assert marker_attributes(page)==a_marker

    # Refresh preserves the original persisted distance drafts and keeps inputs closed.
    # Diagram markers remain intentionally page-memory-only, never Raw/GPS positions.
    select_player(page,group,1)
    before_raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    putting_collapsed(page)
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_raw
    open_putting(page,'TEST 선수 B')
    assert float(page.locator('#lessonPuttDistanceInput').input_value())==8
    before_a=storage_group(page)['players'][0]
    click(page,'#lessonPuttHoled')
    waiting=storage_group(page)
    assert waiting['players'][0]==before_a
    assert waiting['selectedPlayerId']==group['players'][1]['playerId']
    assert all(p['round']['currentHole']==hole for p in waiting['players'])
    assert hole_for(waiting,1,hole)['completed'] and hole_for(waiting,1,hole)['score']==2
    assert hole_for(waiting,1,hole)['putts']==1
    select_player(page,group,0)
    open_putting(page,'TEST 선수 A')
    assert float(page.locator('#lessonPuttDistanceInput').input_value())==1.5
    click(page,'#lessonPuttHoled')
    advanced=storage_group(page)
    assert advanced['selectedPlayerId']==group['players'][0]['playerId']
    assert all(p['round']['currentHole']==hole+1 for p in advanced['players'])
    for i in [0,1]:
        h=hole_for(advanced,i,hole)
        assert h['completed'] and h['score']==2 and h['putts']==1 and len(h['shots'])==1
    assert_personal(page,personal)
    return {'explicit_putting_par3_A_green_B_green_B_putt_A_putt':'PASS',
      'explicit_putting_drafts_markers_switch_refresh':'PASS','explicit_putting_par3_hole':hole}


def explicit_putting_interleaved_short_flow(page,source,url):
    """Actual PAR3: A ON GREEN -> A SHORT -> B ON GREEN -> B putt."""
    data,personal=fixture(page,source,url,'par3',count=2)
    group=data['group'];hole=data['hole']
    on_green_ui(page,data['greenPoint'],0,hole)
    open_putting(page,'TEST 선수 A')
    reveal(page,'#lessonPuttDistanceInput').fill('8.0')
    click(page,'#lessonPuttShort')
    a=hole_for(storage_group(page),0,hole)
    assert a['putts']==1 and a['score']==2 and a['puttsDetail'][0]['result']=='SHORT' and not a['completed']
    reveal(page,'#lessonPuttDistanceInput').fill('1.0')
    before_a=storage_group(page)['players'][0]
    select_player(page,group,1)
    on_green_ui(page,data['greenPoint2'],1,hole)
    assert storage_group(page)['players'][0]==before_a
    open_putting(page,'TEST 선수 B')
    reveal(page,'#lessonPuttDistanceInput').fill('2.0')
    click(page,'#lessonPuttHoled')
    waiting=storage_group(page)
    assert waiting['players'][0]==before_a
    assert all(p['round']['currentHole']==hole for p in waiting['players'])
    assert hole_for(waiting,1,hole)['completed'] and hole_for(waiting,1,hole)['putts']==1
    select_player(page,group,0)
    open_putting(page,'TEST 선수 A')
    assert float(page.locator('#lessonPuttDistanceInput').input_value())==1
    click(page,'#lessonPuttHoled')
    advanced=storage_group(page)
    assert all(p['round']['currentHole']==hole+1 for p in advanced['players'])
    a=hole_for(advanced,0,hole);b=hole_for(advanced,1,hole)
    assert a['completed'] and a['putts']==2 and a['score']==3 and len(a['shots'])==1
    assert [p['result'] for p in a['puttsDetail']]==['SHORT','HOLED']
    assert b['completed'] and b['putts']==1 and b['score']==2 and len(b['shots'])==1
    assert_personal(page,personal)
    return {'explicit_putting_par3_A_green_A_short_B_green_B_putt':'PASS'}


def shot_distances_full_hole_flow(page,source,url,out,label):
    """Map Touch -> linked physical distances -> ON GREEN -> full putting history."""
    data,personal=fixture(page,source,url,'empty',count=2)
    group=data['group'];hole=data['hole']
    points=page.evaluate('''()=>{
      const g=JSON.parse(localStorage.getItem('jgi_course_lesson_group_v1')),
        r=g.players[0].round,h=activeCourseData(r).holes[String(r.currentHole)];
      return {first:{lat:h.t[0],lng:h.t[1]},second:{lat:(h.t[0]+h.g[0])/2,lng:(h.t[1]+h.g[1])/2}};
    }''')
    main_map_click(page,points['first'])
    click(page,'#lessonConfirmPosition')
    click(page,'#lessonShotSave')
    first=hole_for(storage_group(page),0,hole)['shots'][0]
    assert first['start']['source']=='MANUAL_DROP' and first['status']=='PENDING_RESULT' and first['distanceM'] is None
    expect(page.locator('#lessonShotDistance')).to_contain_text('TEST 선수 A')
    expect(page.locator('#lessonShotDistance')).to_contain_text('거리 미확정')
    expect(page.locator('#lessonShotDistance')).not_to_contain_text(' · 0m')
    rows=reveal(page,'#lessonShotHistory').locator('button')
    expect(rows.nth(0)).to_contain_text('거리 미확정')

    main_map_click(page,points['second'])
    candidate=hole_for(storage_group(page),0,hole)['shots'][0]
    assert candidate==first, 'An unconfirmed candidate changed the prior physical Shot'
    expect(page.locator('#lessonShotDistance')).to_contain_text('거리 미확정')
    click(page,'#lessonConfirmPosition')
    confirmed=hole_for(storage_group(page),0,hole)['shots'][0]
    assert confirmed['result']['type']=='NEXT_SHOT_START' and confirmed['distanceM']>10
    distance1=displayed_metres(page,confirmed['distanceM'])
    expect(page.locator('#lessonShotDistance')).to_contain_text(distance1)
    click(page,'#lessonShotSave')
    a=hole_for(storage_group(page),0,hole)
    assert len(a['shots'])==2 and a['shots'][1]['distanceM'] is None
    assert a['shots'][0]['distanceM']==confirmed['distanceM']
    expect(page.locator('#lessonShotDistance')).to_contain_text('Shot 1 → Shot 2')
    expect(page.locator('#lessonShotDistance')).to_contain_text(distance1)
    rows=reveal(page,'#lessonShotHistory').locator('button')
    expect(rows).to_have_count(2)
    expect(rows.nth(0)).to_contain_text(distance1)
    expect(rows.nth(1)).to_contain_text('거리 미확정')

    # Another player's pending Shot must not borrow A's known distance.
    before_a=storage_group(page)['players'][0]
    select_player(page,group,1)
    main_map_click(page,points['first'])
    click(page,'#lessonConfirmPosition')
    click(page,'#lessonShotSave')
    expect(page.locator('#lessonShotDistance')).to_contain_text('TEST 선수 B')
    expect(page.locator('#lessonShotDistance')).to_contain_text('거리 미확정')
    assert storage_group(page)['players'][0]==before_a
    before_b=storage_group(page)['players'][1]
    select_player(page,group,0)
    expect(page.locator('#lessonShotDistance')).to_contain_text(distance1)
    before_raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_raw
    expect(page.locator('#lessonShotDistance')).to_contain_text('Shot 1 → Shot 2')
    expect(page.locator('#lessonShotDistance')).to_contain_text(distance1)

    click(page,'#lessonUndoShot')
    undone=hole_for(storage_group(page),0,hole)
    assert len(undone['shots'])==1 and undone['shots'][0]['status']=='PENDING_RESULT'
    assert undone['shots'][0]['end'] is None and undone['shots'][0]['distanceM'] is None
    assert storage_group(page)['players'][1]==before_b
    expect(page.locator('#lessonShotDistance')).to_contain_text('거리 미확정')
    rows=reveal(page,'#lessonShotHistory').locator('button')
    expect(rows).to_have_count(1)
    expect(rows.nth(0)).to_contain_text('거리 미확정')

    # Recreate Shot2 through the ordinary UI, then finish its saved End on the Green.
    main_map_click(page,points['second'])
    click(page,'#lessonConfirmPosition')
    click(page,'#lessonShotSave')
    click(page,'#lessonOnGreen')
    green_click(page,data['greenPoint'])
    click(page,'#lessonGreenSkipPin')
    click(page,'#lessonGreenSave')
    putting_collapsed(page)
    ongreen=hole_for(storage_group(page),0,hole)
    assert len(ongreen['shots'])==2 and ongreen['putts']==0
    assert ongreen['shots'][1]['result']['type']=='ON_GREEN' and ongreen['shots'][1]['distanceM']>10
    distance1=displayed_metres(page,ongreen['shots'][0]['distanceM'])
    distance2=displayed_metres(page,ongreen['shots'][1]['distanceM'])
    expect(page.locator('#lessonShotDistance')).to_contain_text('Shot 2 → ON GREEN')
    expect(page.locator('#lessonShotDistance')).to_contain_text(distance2)
    rows=reveal(page,'#lessonShotHistory').locator('button')
    expect(rows.nth(0)).to_contain_text(distance1)
    expect(rows.nth(1)).to_contain_text(distance2)
    open_putting(page,'TEST 선수 A')
    reveal(page,'#lessonPuttDistanceInput').fill('8.0')
    click(page,'#lessonPuttShort')
    expect(page.locator('#lessonShotDistance')).to_contain_text('1 PUTT · 8.0m · SHORT')
    short=hole_for(storage_group(page),0,hole)
    assert short['putts']==1 and short['score']==3 and len(short['shots'])==2
    history=reveal(page,'#lessonShotHistory')
    expect(history.locator('div[data-putt-number="1"]')).to_contain_text('1 PUTT · 8.0m · SHORT')
    expect(history.locator('button')).to_have_count(2)
    reveal(page,'#lessonPuttDistanceInput').fill('1.0')
    click(page,'#lessonPuttHoled')
    complete=storage_group(page);a=hole_for(complete,0,hole)
    assert a['completed'] and a['score']==4 and a['putts']==2 and len(a['shots'])==2
    assert [(p['distanceM'],p['result']) for p in a['puttsDetail']]==[(8,'SHORT'),(1,'HOLED')]
    assert complete['players'][1]==before_b and complete['players'][0]['round']['currentHole']==hole
    expect(page.locator('#lessonShotDistance')).to_contain_text('2 PUTT · 1.0m · HOLED')
    history=reveal(page,'#lessonShotHistory')
    expect(history.locator('button')).to_have_count(2)
    expect(history.locator('div[data-putt-number]')).to_have_count(2)
    expect(history.locator('button').nth(0)).to_contain_text(distance1)
    expect(history.locator('button').nth(1)).to_contain_text(distance2)
    expect(history.locator('div[data-putt-number="1"]')).to_contain_text('8.0m · SHORT')
    expect(history.locator('div[data-putt-number="2"]')).to_contain_text('1.0m · HOLED')
    page.screenshot(path=str(out/f'lesson-{label}-complete-distances.png'),full_page=False)
    expect(reveal(page,'#lessonPuttHistory')).to_contain_text('8.0m · SHORT')
    expect(page.locator('#lessonPuttHistory')).to_contain_text('1.0m · HOLED')
    before_raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(2)
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_raw
    expect(page.locator('#lessonShotDistance')).to_contain_text('2 PUTT · 1.0m · HOLED')
    expect(reveal(page,'#lessonShotHistory').locator('div[data-putt-number]')).to_have_count(2)
    assert_personal(page,personal)

    # Physical HOLED has no measured End; it must remain explicitly unknown.
    data,personal=fixture(page,source,url,'plain',count=2)
    before_b=storage_group(page)['players'][1]
    click(page,'#lessonHoled')
    direct=storage_group(page);h=hole_for(direct,0,data['hole'])
    assert h['completed'] and h['score']==1 and h['shots'][0]['end'] is None and h['shots'][0]['distanceM'] is None
    assert direct['players'][1]==before_b
    expect(page.locator('#lessonShotDistance')).to_contain_text('HOLED · 거리 미확정')
    expect(page.locator('#lessonShotDistance')).not_to_contain_text(' · 0m')
    expect(reveal(page,'#lessonShotHistory').locator('button').nth(0)).to_contain_text('거리 미확정')
    assert_personal(page,personal)
    return {'shot_distance_map_touch_confirm_link_history_undo_restore':'PASS',
      'shot_distance_ongreen_putting_full_hole_history':'PASS','shot_distance_player_isolation_unknown_direct_holed':'PASS'}


def registration_flow(page,url,out,label):
    outcomes=[]
    for count in [1,2,3,4]:
        page.goto(url,wait_until='domcontentloaded')
        page.wait_for_selector('#lessonPlayerCount',state='attached')
        personal=personal_storage(page)
        # A registered group must be archived through the real finish flow before replacement.
        current=storage_group(page)
        if current and any(p['registered'] for p in current['players']):
            click(page,'#lessonFinishRound');page.locator('#lessonFinishConfirm').click()
            assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY) is None
        reveal(page,'#lessonPlayerCount').select_option(str(count))
        click(page,'#lessonCreateGroup')
        g=storage_group(page)
        ids=[(p['playerId'],p['roundId']) for p in g['players']]
        assert len(g['players'])==count
        for i,p in enumerate(g['players']):
            reveal(page,'#lessonManagePlayer').select_option(p['playerId'])
            page.locator('#lessonName').fill('TEST 등록 '+chr(65+i))
            page.locator('#lessonContact').fill('TEST-TEL-00'+str(i+1))
            page.locator('#lessonSex').select_option('MALE' if i%2 else 'FEMALE')
            page.locator('#lessonHandicap').fill(str(7+i))
            page.locator('#lessonTee').select_option('Blue' if i%2 else 'Red')
            click(page,'#lessonRegisterPlayer')
            saved=storage_group(page)['players'][i]
            assert saved['registered'] and saved['profile']['name']=='TEST 등록 '+chr(65+i)
            assert saved['round']['playerHandicap']==7+i
        registered=storage_group(page)
        assert [(p['playerId'],p['roundId']) for p in registered['players']]==ids
        if count==4:
            page.locator('#lessonManagePlayer').select_option(registered['players'][0]['playerId'])
            page.locator('#lessonName').fill('TEST 수정 A')
            click(page,'#lessonManageClose')
            reveal(page,'#lessonName')
            expect(page.locator('#lessonName')).to_have_value('TEST 수정 A')
            page.locator('#lessonManagePlayer').select_option(registered['players'][1]['playerId'])
            page.locator('#lessonManagePlayer').select_option(registered['players'][0]['playerId'])
            expect(page.locator('#lessonName')).to_have_value('TEST 수정 A')
            click(page,'#lessonSaveGroup')
            assert storage_group(page)['players'][0]['draft']['name']=='TEST 수정 A'
            click(page,'#lessonRegisterPlayer')
            assert storage_group(page)['players'][0]['profile']['name']=='TEST 수정 A'
            assert [(p['playerId'],p['roundId']) for p in storage_group(page)['players']]==ids
            page.screenshot(path=str(out/f'lesson-{label}-manage.png'),full_page=False)
        click(page,'#lessonManageDone')
        expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(count)
        before_raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('#lessonPlayers .lessonPlayer')).to_have_count(count)
        assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before_raw
        assert_personal(page,personal)
        outcomes.append(count)
    return {'ui_registration_player_counts':outcomes,'manage_close_switch_draft_save_identity':'PASS'}


def marker_flow(page,source,url):
    data,personal=fixture(page,source,url,'mixed')
    g=data['group']
    select_player(page,g,1)
    before=storage_group(page)['players'][1]['round']['holes'][0]['puttingReady']['ballPosition']
    putt_diagram_click(page,250,180)
    expect(page.locator('#lessonPuttBall')).to_have_attribute('visibility','visible')
    expect(page.locator('#lessonPuttLine')).to_have_attribute('visibility','visible')
    bxy=page.locator('#lessonPuttBall').evaluate('(el)=>[Number(el.getAttribute("cx")),Number(el.getAttribute("cy"))]')
    assert abs(bxy[0]-250)<1 and abs(bxy[1]-180)<1
    putt_diagram_click(page,260,190)
    moved=page.locator('#lessonPuttBall').evaluate('(el)=>[Number(el.getAttribute("cx")),Number(el.getAttribute("cy"))]')
    assert moved!=bxy
    assert storage_group(page)['players'][1]['round']['holes'][0]['puttingReady']['ballPosition']==before
    select_player(page,g,0)
    click(page,'#lessonOnGreen')
    green_click(page,data['greenPoint'])
    click(page,'#lessonGreenSkipPin')
    click(page,'#lessonGreenSave')
    expect(page.locator('#lessonPuttBall')).to_have_attribute('visibility','hidden')
    putt_diagram_click(page,180,250)
    axy=page.locator('#lessonPuttBall').evaluate('(el)=>[Number(el.getAttribute("cx")),Number(el.getAttribute("cy"))]')
    select_player(page,g,1)
    assert page.locator('#lessonPuttBall').evaluate('(el)=>[Number(el.getAttribute("cx")),Number(el.getAttribute("cy"))]')==moved
    select_player(page,g,0)
    assert page.locator('#lessonPuttBall').evaluate('(el)=>[Number(el.getAttribute("cx")),Number(el.getAttribute("cy"))]')==axy
    assert_personal(page,personal)
    return {'putt_marker_line_touch_update_player_isolation_raw_position_unchanged':'PASS'}


def hole_map_flow(page,source,url):
    data,personal=fixture(page,source,url,'plain')
    before=storage_group(page)
    shapes=[]
    for hole in [1,2,3,1]:
        reveal(page,'#lessonHole').select_option(str(hole))
        expect(page.locator('#lessonCourseSvg')).to_have_attribute('data-hole',str(hole))
        paths=page.locator('#lessonCourseSvg [data-course-shape]').evaluate_all('(els)=>els.map(el=>el.getAttribute("d"))')
        assert paths,'Missing GI map geometry'
        shapes.append(paths)
    assert shapes[0]!=shapes[1] and shapes[1]!=shapes[2] and shapes[3]==shapes[0]
    after=storage_group(page)
    for old,new in zip(before['players'],after['players']):
        assert old['round']['holes']==new['round']['holes']
    assert_personal(page,personal)
    return {'hole_maps_1_2_3_1_and_historical_records':'PASS'}


def penalty_flow(page,source,url,out,label):
    data,personal=fixture(page,source,url,'plain',count=2)
    group=data['group']
    original=storage_group(page)
    def unaffected(player):
        copy=json.loads(json.dumps(player))
        for h in copy['round']['holes']:
            for key in ['penalties','penaltyEvents','score']:h.pop(key,None)
        copy['round'].pop('analysisSnapshot',None)
        return copy
    def open_penalty(name):
        click(page,'#lessonPenaltyOpen')
        expect(page.locator('#lessonPenaltyDialog')).to_be_visible()
        expect(page.locator('#lessonPenaltyTarget')).to_contain_text(name)
        expect(page.locator('#lessonPenaltyStrokeValue')).to_have_text('1')
        expect(page.locator('#lessonPenaltyMinus')).to_be_disabled()
        expect(page.locator('#lessonSavePenaltyBtn')).to_be_disabled()
    def save_penalty(name,kind,strokes):
        open_penalty(name)
        page.locator('#lessonPenaltyTypeChoice [data-v="'+kind+'"]').click()
        for _ in range(strokes-1):click(page,'#lessonPenaltyPlus')
        click(page,'#lessonSavePenaltyBtn')
        expect(page.locator('#lessonPenaltyDialog')).not_to_be_visible()
    for selector in ['#lessonShotSave','#lessonPenaltyOpen']:assert_inside_viewport(page,selector)
    # 9bc3e3b intentionally centers the smaller 44px button beside SHOT SAVE.
    boxes=page.locator('#lessonPenaltyOpen').evaluate('''el=>{let a=el.getBoundingClientRect(),b=document.querySelector('#lessonShotSave').getBoundingClientRect(),c=getComputedStyle(el);return {right:a.x>=b.right-1,sameRow:Math.abs((a.y+a.height/2)-(b.y+b.height/2))<1,bg:c.backgroundColor,color:c.color};}''')
    assert boxes=={'right':True,'sameRow':True,'bg':'rgb(198, 40, 54)','color':'rgb(255, 255, 255)'},boxes
    raw=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    open_penalty('TEST 선수 A')
    expect(page.locator('#lessonPenaltyTypeChoice button')).to_have_count(3)
    page.locator('#lessonPenaltyTypeChoice [data-v="OB"]').click()
    for _ in range(8):click(page,'#lessonPenaltyPlus')
    expect(page.locator('#lessonPenaltyStrokeValue')).to_have_text('9')
    expect(page.locator('#lessonPenaltyPlus')).to_be_disabled()
    click(page,'#lessonPenaltyClose')
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==raw
    open_penalty('TEST 선수 A')
    page.keyboard.press('Escape')
    expect(page.locator('#lessonPenaltyDialog')).not_to_be_visible()
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==raw

    # Late native close events cannot erase a newly opened draft; repeated save is one event.
    page.evaluate('''()=>{const q=id=>document.getElementById(id);q('lessonPenaltyOpen').click();q('lessonPenaltyClose').click();q('lessonPenaltyOpen').click();q('lessonPenaltyTypeChoice').querySelector('[data-v="OB"]').click();}''')
    expect(page.locator('#lessonSavePenaltyBtn')).to_be_enabled()
    # A programmatic player switch is explicitly blocked while this target is locked.
    page.locator('#lessonPlayers [data-player-id="'+group['players'][1]['playerId']+'"]').evaluate('(el)=>el.click()')
    assert selected(storage_group(page))['playerId']==group['players'][0]['playerId']
    page.locator('#lessonSavePenaltyBtn').evaluate('(el)=>{el.click();el.click();}')
    expect(page.locator('#lessonPenaltyDialog')).not_to_be_visible()
    a=hole_for(storage_group(page),0,1)
    assert a['penalties']==1 and a['score']==2 and len(a['penaltyEvents'])==1
    first=a['penaltyEvents'][0]
    assert first['type']=='OB' and first['strokes']==1 and first['hole']==1 and first['at']>0 and first['id'].startswith('clpen_')
    select_player(page,group,1)
    save_penalty('TEST 선수 B','HAZARD',2)
    select_player(page,group,0)
    page.context.set_offline(True)
    try:save_penalty('TEST 선수 A','LOST_BALL',1)
    finally:page.context.set_offline(False)
    state=storage_group(page)
    for i in [0,1]:
        h=hole_for(state,i,1)
        assert h['penalties']==2 and h['score']==3 and len(h['shots'])==1 and h['putts']==0
        assert unaffected(state['players'][i])==unaffected(original['players'][i])
        expect(page.locator('#lessonPlayers [data-player-id="'+state['players'][i]['playerId']+'"]')).to_contain_text('벌 2')
    history=reveal(page,'#lessonPenaltyHistory')
    expect(history.locator('button')).to_have_count(2)
    assert_inside_viewport(page,'#lessonPenaltyHistory [data-penalty-id="'+first['id']+'"]')
    page.screenshot(path=str(out/f'lesson-{label}-penalty-history.png'),full_page=False)
    history.locator('[data-penalty-id="'+first['id']+'"]').click()
    state=storage_group(page)
    assert hole_for(state,0,1)['penalties']==1 and hole_for(state,0,1)['score']==2
    assert hole_for(state,1,1)['penalties']==2 and hole_for(state,1,1)['score']==3
    before=page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#lessonPenaltyMeta')).to_contain_text('벌타 1')
    assert page.evaluate('(key)=>localStorage.getItem(key)',GROUP_KEY)==before
    expect(reveal(page,'#lessonPenaltyHistory')).to_contain_text('LOST BALL')
    assert_personal(page,personal)
    open_penalty('TEST 선수 A')
    for selector in ['#lessonPenaltyMinus','#lessonPenaltyPlus','#lessonSavePenaltyBtn','#lessonPenaltyClose']:assert_inside_viewport(page,selector)
    page.screenshot(path=str(out/f'lesson-{label}-penalty-dialog.png'),full_page=False)
    click(page,'#lessonPenaltyClose')
    # Smaller iPhones keep both primary actions tappable and in the requested order.
    old=page.viewport_size
    page.set_viewport_size({'width':320,'height':740})
    for selector in ['#lessonShotSave','#lessonPenaltyOpen']:assert_inside_viewport(page,selector)
    open_penalty('TEST 선수 A')
    for selector in ['#lessonPenaltyMinus','#lessonPenaltyPlus','#lessonSavePenaltyBtn']:assert_inside_viewport(page,selector)
    click(page,'#lessonPenaltyClose');page.set_viewport_size(old)

    # Penalties during putting preserve the exact draft and normal Score/HOLED behavior.
    data,personal=fixture(page,source,url,'mixed',count=4);group=data['group']
    select_player(page,group,1)
    before=storage_group(page);ready=hole_for(before,1,1)['puttingReady']
    save_penalty('TEST 선수 B','HAZARD',1)
    state=storage_group(page)
    assert hole_for(state,1,1)['puttingReady']==ready
    assert unaffected(state['players'][1])==unaffected(before['players'][1])
    for i in [0,2,3]:assert state['players'][i]==before['players'][i]
    event=hole_for(state,1,1)['penaltyEvents'][0]
    open_putting(page,'TEST 선수 B')
    click(page,'#lessonPuttShort')
    assert hole_for(storage_group(page),1,1)['score']==3
    reveal(page,'#lessonPuttDistanceInput').fill('1.0');click(page,'#lessonPuttHoled')
    completed=storage_group(page);assert hole_for(completed,1,1)['completed'] and hole_for(completed,1,1)['score']==4
    click(page,'#lessonPenaltyHistory [data-penalty-id="'+event['id']+'"]')
    after=storage_group(page);h=hole_for(after,1,1)
    assert h['completed'] and h['score']==3 and h['putts']==2 and len(h['shots'])==1 and h['penalties']==0
    assert h['shots']==hole_for(completed,1,1)['shots'] and h['puttsDetail']==hole_for(completed,1,1)['puttsDetail']
    assert_personal(page,personal)
    return {'penalty_A_OB1_B_HAZARD2_A_LOST1_score_cancel_restore':'PASS','penalty_bounds_cancel_no_write_duplicate_target_lock':'PASS','penalty_putting_holeout_positions_and_other_players_preserved':'PASS','penalty_primary_actions_mobile_320_and_current_viewport':'PASS'}


def round_screenshot(browser,base,out,width,height,label):
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
    context.add_init_script(INIT_SCRIPT)
    context.route('**/*',lambda route: gate(route,base))
    page=context.new_page()
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(base+'/',wait_until='domcontentloaded')
    page.evaluate('startRoundWithCondition()')
    expect(page.locator('#roundScreen')).to_be_visible()
    expect(page.locator('body')).to_have_class(re.compile(r'.*\bround-active\b.*'))
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    page.wait_for_timeout(200)
    style=page.evaluate('''()=>({body:document.body.className,round:document.querySelector('#roundScreen').className,
      pill:getComputedStyle(document.querySelector('#mapFirstShotPill')).backgroundColor,
      pillColor:getComputedStyle(document.querySelector('#mapFirstShotPill')).color})''')
    (out/f'round-{label}-style.json').write_text(json.dumps(style,ensure_ascii=False,indent=2))
    page.screenshot(path=str(out/f'round-{label}.png'),full_page=False)
    context.close()


def gate(route,base):
    u=urlparse(route.request.url)
    allowed=urlparse(base)
    if u.hostname!=allowed.hostname or u.port!=allowed.port or u.path.startswith('/api/'):
        route.abort('blockedbyclient')
        return
    if u.path=='/runtime-config.js':
        route.fulfill(status=200,content_type='text/javascript',body='window.JGI_RUNTIME_CONFIG={googleMapsBrowserKey:""};')
        return
    route.continue_()


def home_entry_and_reset_flow(page, base):
    """HOME opens a fresh real-test lesson; only the old Course Lesson Group is cleared."""
    page.goto(base+'/', wait_until='domcontentloaded')
    button=page.locator('#enterCourseLessonBtn')
    expect(button).to_be_enabled()
    before=page.evaluate("localStorage.getItem('agi_player_v1_round')")
    page.evaluate("localStorage.setItem('jgi_course_lesson_dev_group_v1', 'OLD_TEST_ONLY')")
    button.click()
    page.wait_for_url(re.compile(r'\\?courseLesson=1'))
    expect(page.locator('#courseLessonDev')).to_be_visible()
    assert page.evaluate("localStorage.getItem('jgi_course_lesson_dev_group_v1')") is None
    assert page.evaluate("localStorage.getItem('agi_player_v1_round')") == before
    assert page.locator('#lessonManageDialog').count() == 1
    return {'home_entry_and_test_reset': 'PASS'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='',help='Optional already-running localhost server; otherwise starts a read-only local server.')
    parser.add_argument('--repo',default=str(REPO),help='Read-only source root; defaults to the repository containing this test.')
    parser.add_argument('--out',default='',help='Output folder; defaults to a new directory under the system temp folder.')
    args=parser.parse_args()
    repo=Path(args.repo).resolve()
    out=Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix='jgi-lesson-ui-'))
    out.mkdir(parents=True,exist_ok=True)
    source=(repo/'course-lesson.js').read_text()
    server=None
    if args.base_url:
        base=args.base_url.rstrip('/')
        assert urlparse(base).hostname in ['127.0.0.1','localhost'], 'Only localhost testing allowed'
    else:
        handler=functools.partial(SafeHandler,directory=str(repo))
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base='http://127.0.0.1:'+str(server.server_address[1])
    results={'environment':'Local cloud Chromium, no real GPS/Google SDK/API; not Safari or physical devices','runs':[]}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for width,height,label in [(390,844,'iphone'),(820,1180,'ipad'),(844,390,'iphone-landscape'),(1180,820,'ipad-landscape')]:
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
                context.add_init_script(INIT_SCRIPT)
                context.route('**/*',lambda route:gate(route,base))
                page=context.new_page();page.set_default_timeout(10000)
                page.on('dialog',lambda dialog:dialog.accept())
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)[:300]))
                url=base+'/?courseLessonDev=1'
                run={'viewport':[width,height]}
                run.update(mixed_flow(page,source,url,out,label))
                run.update(undo_green_flow(page,source,url,out,label))
                run.update(gps_ownership_flow(page,source,url))
                run.update(auto_next_flow(page,source,url))
                run.update(marker_flow(page,source,url))
                run.update(hole_map_flow(page,source,url))
                run.update(registration_flow(page,url,out,label))
                run.update(explicit_putting_free_order_flow(page,source,url,out,label))
                run.update(explicit_putting_interleaved_short_flow(page,source,url))
                run.update(shot_distances_full_hole_flow(page,source,url,out,label))
                run.update(penalty_flow(page,source,url,out,label))
                run.update(home_entry_and_reset_flow(page,base))
                assert not errors,errors
                run['uncaught_page_errors']=errors
                results['runs'].append(run)
                context.close()
                round_screenshot(browser,base,out,width,height,label)
            browser.close()
        results['status']='PASS'
    except Exception as error:
        results['status']='FAIL';results['error']=str(error)
        (out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
        raise
    finally:
        if server:server.shutdown()
    (out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps({'output':str(out),**results},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
