'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const lesson=require('../course-lesson.js');
function services(){
  let sequence=0;
  return {uuid:()=>String(++sequence),now:()=>1234,courseVersion:'TEST_COURSE',dataVersion:'TEST_SG',
    clubs:['DR','7I'],shotContext:r=>({holeId:r.currentHole+100,courseId:22987,sgBenchmarkVersion:'TEST_SG',startGreenDistanceM:100}),
    distance:(a,b)=>Math.hypot(a.lat-b.lat,a.lng-b.lng)*111320,
    greenGeometry:(r,hole)=>({hole,holeId:hole+100,courseId:22987,geometryVersion:'TEST_GREEN',polygons:[[
      {lat:-6.455,lng:106.882},{lat:-6.456,lng:106.882},{lat:-6.456,lng:106.883},{lat:-6.455,lng:106.883}
    ]]}),
    benchmark:r=>({handicap:r.playerHandicap,label:r.sgBenchmarkMode+' '+r.playerHandicap,type:'MODELED',fallback:false}),
    hydrate:r=>r};
}
const draft=(name='TEST 선수 A',sex='FEMALE',handicap='5',tee='Red')=>({name,contact:'TEST-WA-001',sex,handicap,tee});
function memory(){
  const values=new Map([['agi_player_v1_round','unchanged-player'],['jgi_completed_rounds_v1','unchanged-history']]);
  return {values,getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)};
}
for(const count of [1,2,3,4])test(count+'명 등록: 독립 ID와 Round, 기존 Group 불변',()=>{
  const engine=services(),group=lesson.createGroup(count,engine);let next=group;
  for(const [i,p] of group.players.entries())next=lesson.registerPlayer(next,p.playerId,draft('TEST 선수 '+i,i%2?'MALE':'FEMALE',String(i+1),i%2?'Blue':'Red'),engine);
  assert.equal(next.players.filter(p=>p.registered).length,count);
  assert.equal(group.players.filter(p=>p.registered).length,0);
  assert.equal(new Set(next.players.flatMap(p=>[p.playerId,p.round.id])).size,count*2);
  for(const p of next.players){assert.equal(p.round.groupId,next.groupId);assert.equal(p.round.playerId,p.playerId);assert.equal(p.round.holes.length,18);assert.equal(p.round.startedAt,null);}
  if(count>1){next.players[0].round.holes[0].shots.push({id:'TEST_INDEPENDENCE'});assert.equal(next.players[1].round.holes[0].shots.length,0);}
});
test('A → B → A: 등록/미등록 Draft와 Round 입력 독립 보존',()=>{
  const engine=services();let group=lesson.createGroup(2,engine);const [a,b]=group.players;
  group=lesson.registerPlayer(group,a.playerId,draft(),engine);
  group.players[0].round.currentHole=3;
  group.players[0].round.pending={id:'TEST_PENDING',club:'TEST_CLUB'};
  group=lesson.updateDraft(group,a.playerId,draft('TEST 임시 A','FEMALE','6','White'));
  group=lesson.selectPlayer(group,b.playerId);
  group=lesson.updateDraft(group,b.playerId,draft('TEST 임시 B','MALE','12','Blue'));
  group=lesson.selectPlayer(group,a.playerId);
  assert.equal(group.players[0].draft.name,'TEST 임시 A');assert.equal(group.players[1].draft.name,'TEST 임시 B');
  assert.equal(group.players[0].round.currentHole,3);assert.equal(group.players[0].round.pending.id,'TEST_PENDING');
  const oldId=group.players[0].round.id;
  group=lesson.registerPlayer(group,a.playerId,group.players[0].draft,engine);
  assert.equal(group.players[0].round.id,oldId);assert.equal(group.players[0].round.currentHole,3);assert.equal(group.players[0].round.pending.id,'TEST_PENDING');
});
test('Group 저장/복원은 별도 namespace만 사용하고 참조를 공유하지 않음',()=>{
  const engine=services(),store=memory();let group=lesson.createGroup(2,engine);
  group=lesson.registerPlayer(group,group.players[0].playerId,draft(),engine);
  group=lesson.updateDraft(group,group.players[1].playerId,draft('TEST 미등록 B'));
  group=lesson.selectPlayer(group,group.players[1].playerId);
  lesson.saveGroup(store,group);const restored=lesson.restoreGroup(store);
  assert.deepEqual(restored,group);restored.players[0].round.holes[0].shots.push({id:'TEST'});
  assert.equal(group.players[0].round.holes[0].shots.length,0);
  assert.equal(store.values.get('agi_player_v1_round'),'unchanged-player');assert.equal(store.values.get('jgi_completed_rounds_v1'),'unchanged-history');
});
test('지원 범위 밖 Handicap과 실제 연락처 입력을 저장하지 않음',()=>{
  const engine=services(),group=lesson.createGroup(1,engine),p=group.players[0];
  for(const bad of [draft('실제 이름'),{...draft(),contact:'+82 10 1234 5678'},draft('TEST A','FEMALE','29'),draft('TEST A','MALE','26'),draft('TEST A','MALE','-1'),draft('TEST A','MALE','')])
    assert.throws(()=>lesson.registerPlayer(group,p.playerId,bad,engine));
  for(const [sex,h] of [['MALE','0'],['MALE','25'],['FEMALE','0'],['FEMALE','28']])
    assert.equal(lesson.registerPlayer(group,p.playerId,draft('TEST A',sex,h),engine).players[0].round.playerHandicap,Number(h));
  for(const n of [0,5,1.5])assert.throws(()=>lesson.createGroup(n,engine));
});
test('불완전 Benchmark, 중복 ID, 소유자 불일치, 손상 저장을 거부',()=>{
  const engine=services(),store=memory();let group=lesson.createGroup(2,engine);
  assert.throws(()=>lesson.registerPlayer(group,group.players[0].playerId,draft(),{...engine,benchmark:()=>({fallback:true})}));
  const duplicate=structuredClone(group);duplicate.players[1].playerId=duplicate.players[0].playerId;
  assert.throws(()=>lesson.saveGroup(store,duplicate));assert.equal(store.getItem(lesson.STORAGE),null);
  group=lesson.registerPlayer(group,group.players[0].playerId,draft(),engine);
  const wrong=structuredClone(group);wrong.players[0].round.playerId=wrong.players[1].playerId;assert.throws(()=>lesson.validateGroup(wrong));
  for(const raw of ['invalid json',JSON.stringify({...group,version:2}),JSON.stringify({...group,selectedPlayerId:'missing'})]){
    store.setItem(lesson.STORAGE,raw);assert.throws(()=>lesson.restoreGroup(store));assert.equal(store.getItem(lesson.STORAGE),raw);
  }
});
test('저장 실패를 성공으로 처리하지 않음',()=>{
  const group=lesson.createGroup(1,services());
  assert.throws(()=>lesson.saveGroup({setItem:()=>{throw new Error('quota');},getItem:()=>null},group),/quota/);
  assert.throws(()=>lesson.saveGroup({setItem:()=>{},getItem:()=>null},group),/저장 확인/);
});
test('Male/HCP20/Blue: WA/TEL 입력·정규화·등록·전환·복원 후 ID와 인원 유지',()=>{
  for(const contact of ['TEST-WA-001','TEST-TEL-001',' TEST-WA-001 ','\u00a0TEST-TEL-001\u00a0','TEST\u2011WA\u2011001','TEST\u2013TEL\u2013001','TEST\uFF0DWA\uFF0D001']){
    const engine=services(),store=memory();let group=lesson.createGroup(2,engine);
    const [a,b]=group.players,ids=group.players.map(p=>[p.playerId,p.roundId]);
    group=lesson.registerPlayer(group,a.playerId,{...draft('TEST 선수 A','MALE','20','Blue'),contact},engine);
    const canonical=contact.includes('TEL')?'TEST-TEL-001':'TEST-WA-001';
    assert.equal(group.players[0].draft.contact,canonical);assert.equal(group.players[0].profile.contact,canonical);
    assert.equal(group.players[0].round.playerSex,'MALE');assert.equal(group.players[0].round.playerHandicap,20);assert.equal(group.players[0].round.tee,'Blue');
    group=lesson.selectPlayer(group,b.playerId);
    group=lesson.registerPlayer(group,b.playerId,{...draft('TEST 선수 B'),contact:'TEST-TEL-002'},engine);
    group=lesson.selectPlayer(group,a.playerId);lesson.saveGroup(store,group);
    const restored=lesson.restoreGroup(store);assert.deepEqual(restored,group);
    assert.equal(restored.players.filter(p=>p.registered).length,2);
    assert.deepEqual(restored.players.map(p=>[p.playerId,p.roundId]),ids);
    assert.equal(restored.players[0].draft.contact,canonical);
  }
});
test('미등록 Draft 전환/저장에도 연락처 정규화를 적용하며 허용 형식은 유지',()=>{
  const engine=services(),store=memory();let group=lesson.createGroup(2,engine);
  const [a,b]=group.players;
  group=lesson.updateDraft(group,a.playerId,{...draft(),contact:' TEST\u2011TEL\u2011001 '});
  group=lesson.selectPlayer(group,b.playerId);lesson.saveGroup(store,group);
  group=lesson.selectPlayer(lesson.restoreGroup(store),a.playerId);
  assert.equal(group.players[0].draft.contact,'TEST-TEL-001');
  for(const contact of ['TEST-WA-00','TEST-WA-0001','TEST WA 001','TEST-WA-001x','+82-10-1234-5678'])
    assert.throws(()=>lesson.registerPlayer(group,a.playerId,{...draft(),contact},engine));
});
test('개발 진입점은 명시적 query + localhost/지정 branch Preview에서만 허용',()=>{
  const check=(hostname,search)=>lesson.developmentAllowed({hostname,search});
  assert.equal(check('localhost','?courseLessonDev=1'),true);
  assert.equal(check('jgi-course-gps-test-git-ui-course-less-faefbe-jmboatskorea-9766.vercel.app','?courseLessonDev=1'),true);
  for(const hostname of ['jgi-course-gps-test.vercel.app','example.com','localhost.example.com'])assert.equal(check(hostname,'?courseLessonDev=1'),false);
  assert.equal(check('localhost',''),false);
});
const mapPoint=()=>({lat:-6.45336,lng:106.878002,accuracy:null,time:1000,source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
const gpsPoint=()=>({lat:-6.4534,lng:106.8781,accuracy:7,time:1100,source:'GPS'});
function registeredGroup(count,engine){
  let group=lesson.createGroup(count,engine);
  for(const [i,p] of group.players.entries())group=lesson.registerPlayer(group,p.playerId,draft('TEST 선수 '+i),engine);
  return group;
}
for(const count of [1,2,3,4])test('Phase 3A '+count+'명: 자유 순서에서 각 Physical Shot 1회와 출처/정확도 보존',()=>{
  const engine=services(),original=registeredGroup(count,engine);let group=original;
  for(const p of [...group.players].reverse()){
    group=lesson.selectPlayer(group,p.playerId);
    group=lesson.stagePosition(group,p.playerId,count%2?gpsPoint():mapPoint());
    assert.throws(()=>lesson.recordShot(group,p.playerId,engine),/확인/);
    group=lesson.confirmPosition(group,p.playerId,engine);
    group=lesson.recordShot(group,p.playerId,engine);
    assert.throws(()=>lesson.recordShot(group,p.playerId,engine),/확인/);
  }
  for(const p of group.players){
    const h=p.round.holes[0],shot=h.shots[0];assert.equal(h.shots.length,1);assert.equal(shot.shotSequence,1);
    assert.equal(shot.playerId,p.playerId);assert.equal(shot.roundId,p.roundId);assert.equal(p.round.pending.id,shot.id);
    assert.equal(shot.end,null);assert.equal(shot.sg,null);assert.equal(shot.status,'PENDING_RESULT');assert.equal(h.completed,false);
    assert.deepEqual({...shot.start,confirmedAt:undefined},{...(count%2?gpsPoint():mapPoint()),confirmedAt:undefined});
  }
  assert.ok(original.players.every(p=>p.round.holes[0].shots.length===0));
});
test('A → B → A: 클럽/위치 독립, 확인한 다음 시작 위치만 직전 End로 연결',()=>{
  const engine=services();let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=lesson.stagePosition(group,a.playerId,mapPoint());group=lesson.confirmPosition(group,a.playerId,engine);group=lesson.recordShot(group,a.playerId,engine);
  const first=structuredClone(group.players[0].round.holes[0].shots[0]);
  group=lesson.selectPlayer(group,b.playerId);group=lesson.setShotClub(group,b.playerId,'7I',engine);
  group=lesson.stagePosition(group,b.playerId,gpsPoint());group=lesson.confirmPosition(group,b.playerId,engine);group=lesson.recordShot(group,b.playerId,engine);
  const bRound=structuredClone(group.players[1].round);
  group=lesson.selectPlayer(group,a.playerId);assert.equal(group.players[0].shotDraft.club,'DR');
  group=lesson.stagePosition(group,a.playerId,{...mapPoint(),lng:106.879});group=lesson.confirmPosition(group,a.playerId,engine);group=lesson.recordShot(group,a.playerId,engine);
  const connected=group.players[0].round.holes[0].shots[0];
  assert.deepEqual(connected.start,first.start);assert.equal(connected.end.lng,106.879);assert.equal(connected.result.type,'NEXT_SHOT_START');assert.deepEqual(group.players[1].round,bRound);
  assert.deepEqual(group.players[0].round.holes[0].shots.map(s=>s.shotSequence),[1,2]);
  assert.equal(group.players[1].shotDraft.club,'7I');assert.equal(group.players[1].round.holes[0].shots[0].club,'7I');
  assert.ok(group.players[0].round.holes[0].shots.every(s=>s.sg===null));assert.equal(group.players[0].round.holes[0].shots[1].end,null);
});
test('Pending·후보·확인 상태·마커 위치를 Phase 2 Group 저장 키로 정확히 복원',()=>{
  const engine=services(),store=memory();let group=registeredGroup(3,engine);const [a,b,c]=group.players;
  group=lesson.stagePosition(group,a.playerId,mapPoint());group=lesson.confirmPosition(group,a.playerId,engine);group=lesson.recordShot(group,a.playerId,engine);
  group=lesson.stagePosition(group,b.playerId,gpsPoint());group=lesson.confirmPosition(group,b.playerId,engine);
  group=lesson.stagePosition(group,c.playerId,mapPoint());group=lesson.selectPlayer(group,b.playerId);
  lesson.saveGroup(store,group);const restored=lesson.restoreGroup(store);assert.deepEqual(restored,group);
  assert.equal(restored.players[0].round.holes[0].shots.length,1);assert.equal(restored.players[1].shotDraft.confirmed,true);assert.equal(restored.players[2].shotDraft.confirmed,false);
  assert.equal(lesson.recordShot(restored,b.playerId,engine).players[1].round.holes[0].shots.length,1);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');
});
test('Map Touch 후보가 기존 확인 위치를 덮어쓰지 않고 Hole 변경도 End를 확정하지 않음',()=>{
  const engine=services();let group=registeredGroup(1,engine);const p=group.players[0];
  group=lesson.stagePosition(group,p.playerId,gpsPoint());group=lesson.confirmPosition(group,p.playerId,engine);
  const ball=structuredClone(group.players[0].ballPosition);
  group=lesson.stagePosition(group,p.playerId,mapPoint());assert.deepEqual(group.players[0].ballPosition,ball);assert.equal(group.players[0].shotDraft.confirmed,false);
  group=lesson.confirmPosition(group,p.playerId,engine);group=lesson.recordShot(group,p.playerId,engine);
  group=lesson.chooseHole(group,p.playerId,2);assert.equal(group.players[0].shotDraft.position,null);
  group=lesson.stagePosition(group,p.playerId,mapPoint());group=lesson.confirmPosition(group,p.playerId,engine);group=lesson.recordShot(group,p.playerId,engine);
  assert.equal(group.players[0].round.holes[1].shots[0].shotSequence,1);assert.equal(group.players[0].round.holes[0].shots[0].end,null);
});
test('잘못된 좌표/출처/정확도·미등록 선수·Putting 클럽·잘못된 Pending 참조 거부',()=>{
  const engine=services();let group=registeredGroup(1,engine);const p=group.players[0];
  for(const point of [{...gpsPoint(),accuracy:null},{...gpsPoint(),lat:null},{...gpsPoint(),lng:181},{...mapPoint(),accuracy:0},{...mapPoint(),source:'AUTO'},{...mapPoint(),time:0}])
    assert.throws(()=>lesson.stagePosition(group,p.playerId,point));
  assert.throws(()=>lesson.setShotClub(group,p.playerId,'Putter',engine));
  const unregistered=lesson.createGroup(1,engine);assert.throws(()=>lesson.stagePosition(unregistered,unregistered.players[0].playerId,mapPoint()));
  group=lesson.stagePosition(group,p.playerId,mapPoint());group=lesson.confirmPosition(group,p.playerId,engine);group=lesson.recordShot(group,p.playerId,engine);
  const bad=structuredClone(group);bad.players[0].round.pending.id='missing';assert.throws(()=>lesson.validateGroup(bad));
  const invented=structuredClone(group);invented.players[0].round.holes[0].shots[0].sg=0;assert.throws(()=>lesson.validateGroup(invented));
});
test('같은 확인 상태의 재시도는 같은 Shot ID를 사용하고 저장 후 재기록은 거부',()=>{
  const engine=services();let group=registeredGroup(1,engine);const p=group.players[0];
  group=lesson.stagePosition(group,p.playerId,mapPoint());group=lesson.confirmPosition(group,p.playerId,engine);
  const firstAttempt=lesson.recordShot(group,p.playerId,engine),retry=lesson.recordShot(group,p.playerId,engine);
  assert.equal(firstAttempt.players[0].round.holes[0].shots[0].id,retry.players[0].round.holes[0].shots[0].id);
  assert.throws(()=>lesson.recordShot(firstAttempt,p.playerId,engine),/확인/);
});
function physical(group,playerId,point,engine){
  return lesson.recordShot(lesson.confirmPosition(lesson.stagePosition(group,playerId,point),playerId,engine),playerId,engine);
}
const greenPoint=()=>({...mapPoint(),lat:-6.4555,lng:106.8825});
const pinPoint=()=>({...greenPoint(),lat:-6.4556,source:'SCORER_MANUAL_MAP'});
for(const type of ['ON_GREEN','HOLED'])test('과거 Shot 3 (58°) 선택 → '+type+': Shot 4/Pending/다른 선수 보존 및 저장 복원',()=>{
  const engine=services(),store=memory();engine.clubs.push('58°');
  let group=registeredGroup(2,engine);const [a,b]=group.players;
  for(let i=1;i<=4;i++){
    group=lesson.setShotClub(group,a.playerId,i===3?'58°':'DR',engine);
    group=physical(group,a.playerId,mapPoint(),engine);
  }
  group=physical(group,b.playerId,gpsPoint(),engine);
  lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  const before=structuredClone(group),p=group.players[0],target=p.round.holes[0].shots[2];
  assert.equal(target.result.type,'NEXT_SHOT_START');
  assert.equal(lesson.resultTargetShot(p).shotSequence,4);
  assert.equal(lesson.resultTargetShot(p,target.id).shotSequence,3);
  assert.equal(lesson.resultTargetShot(p,target.id).club,'58°');
  assert.equal(lesson.resultTargetShot(p,'missing'),null);
  assert.equal(lesson.resultTargetShot(group.players[1],target.id),null);
  assert.equal(lesson.resultTargetShot(lesson.chooseHole(group,a.playerId,2).players[0],target.id),null);
  group=type==='ON_GREEN'?lesson.onGreen(group,a.playerId,target.id,greenPoint(),null,engine):lesson.holed(group,a.playerId,target.id,engine);
  const after=group.players[0],h=after.round.holes[0];
  assert.equal(h.shots.length,4);assert.equal(h.shots[2].result.type,type);
  assert.deepEqual(h.shots[3],before.players[0].round.holes[0].shots[3]);
  assert.deepEqual(h.shots.slice(0,2),before.players[0].round.holes[0].shots.slice(0,2));
  assert.deepEqual(after.round.pending,before.players[0].round.pending);
  assert.deepEqual(group.players[1],before.players[1]);
  assert.deepEqual(h.shots[2].start,target.start);assert.deepEqual(h.shots[2].originalEnd,target.originalEnd);
  assert.deepEqual(h.shots[2].editHistory.at(-1).previous.result,target.result);
  assert.ok(h.shots.every(s=>s.sg===null));assert.equal(h.putts,0);
  if(type==='ON_GREEN')assert.equal(h.puttingReady.entryShotId,target.id);
  else {assert.equal(h.completed,true);assert.equal(h.score,4);}
  assert.equal(lesson.resultTargetShot(after,target.id),null);
  assert.throws(()=>lesson.holed(group,a.playerId,target.id,engine));
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');
  assert.equal(store.getItem('jgi_completed_rounds_v1'),'unchanged-history');
  assert.deepEqual(before.players[0],p);
});
test('Pending 결과 UI: 복원된 Shot 3 (7I)와 선택 선수의 Raw Shot을 대상으로 타수 없이 확정',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);const [a,b]=group.players;
  for(let i=0;i<3;i++){
    if(i===2)group=lesson.setShotClub(group,a.playerId,'7I',engine);
    group=physical(group,a.playerId,mapPoint(),engine);
  }
  group=physical(group,b.playerId,gpsPoint(),engine);
  group=lesson.setShotClub(group,a.playerId,'DR',engine); // Next club differs from the stored pending shot.
  group.players[0].round.pending=null; // Restored raw record is sufficient; never depend on a global pointer.
  group=lesson.selectPlayer(group,a.playerId);lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  const current=()=>lesson.pendingResultShot(group.players.find(p=>p.playerId===group.selectedPlayerId));
  const unchanged=JSON.stringify(group),target=current();
  assert.equal(target.shotSequence,3);assert.equal(target.club,'7I');assert.equal(target.playerId,a.playerId);
  assert.equal(JSON.stringify(group),unchanged);
  group=lesson.selectPlayer(group,b.playerId);assert.equal(current().playerId,b.playerId);assert.equal(current().shotSequence,1);
  group=lesson.selectPlayer(group,a.playerId);assert.equal(current().id,target.id);
  const beforeB=structuredClone(group.players[1]),beforeEarlier=structuredClone(group.players[0].round.holes[0].shots.slice(0,2));
  group=lesson.onGreen(group,a.playerId,current().id,greenPoint(),null,engine);
  assert.equal(current(),null);assert.equal(group.players[0].round.holes[0].shots.length,3);
  assert.deepEqual(group.players[0].round.holes[0].shots.slice(0,2),beforeEarlier);assert.deepEqual(group.players[1],beforeB);
  group=lesson.selectPlayer(group,b.playerId);group=lesson.holed(group,b.playerId,current().id,engine);
  assert.equal(current(),null);assert.equal(group.players[1].round.holes[0].shots.length,1);assert.equal(group.players[1].round.holes[0].score,1);
});
test('Pending 결과 UI: 다른 홀·미등록·완료·Putting·다음 시작으로 확정된 Shot의 버튼은 숨김',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,mapPoint(),engine);assert.ok(lesson.pendingResultShot(group.players[0]));
  const terminal=structuredClone(group.players[0]);terminal.round.holes[0].completed=true;assert.equal(lesson.pendingResultShot(terminal),null);
  terminal.round.holes[0].completed=false;terminal.round.holes[0].lessonStatus='AWAITING_PUTTING';assert.equal(lesson.pendingResultShot(terminal),null);
  const nextHole=lesson.chooseHole(group,pid,2);assert.equal(lesson.pendingResultShot(nextHole.players[0]),null);
  assert.equal(lesson.pendingResultShot(lesson.createGroup(1,engine).players[0]),null);
  assert.equal(lesson.pendingResultShot(undefined),null);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,gpsPoint()),pid,engine);
  assert.equal(lesson.pendingResultShot(group.players[0]),null);assert.equal(group.players[0].round.holes[0].shots.length,1);
});
test('Phase 3B: Shot 1→2→3→4는 같은 선수의 확인 좌표만 연결하며 Physical Shot을 추가하지 않음',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,gpsPoint(),engine);
  for(let i=2;i<=4;i++){
    const point={...mapPoint(),lng:106.878+i/1000};
    const pending=structuredClone(group.players[0].round.holes[0].shots.at(-1));
    group=lesson.stagePosition(group,pid,point);
    assert.deepEqual(group.players[0].round.holes[0].shots.at(-1),pending);
    group=lesson.confirmPosition(group,pid,engine);
    const h=group.players[0].round.holes[0],last=h.shots.at(-1);
    assert.equal(h.shots.length,i-1);assert.equal(last.status,'RESULT_CONFIRMED');
    assert.deepEqual(last.end,{...point,confirmedAt:engine.now()});assert.equal(last.positionSource.end,'MANUAL_DROP');
    assert.deepEqual(last.start,pending.start);assert.equal(group.players[0].round.pending,null);
    group=lesson.recordShot(group,pid,engine);
    assert.equal(group.players[0].round.holes[0].shots[i-2].result.nextShotId,group.players[0].round.holes[0].shots[i-1].id);
  }
  assert.deepEqual(group.players[0].round.holes[0].shots.map(s=>s.shotSequence),[1,2,3,4]);
  assert.equal(group.players[0].round.holes[0].shots.at(-1).status,'PENDING_RESULT');
});
test('Phase 3B: End 재확인 시 원본 GPS/정확도와 첫 End, 수정 이력 및 연결을 복원',()=>{
  const engine=services(),store=memory();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,gpsPoint(),engine);const start=structuredClone(group.players[0].round.holes[0].shots[0].start);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,gpsPoint()),pid,engine);
  const originalEnd=structuredClone(group.players[0].round.holes[0].shots[0].end);
  lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,mapPoint()),pid,engine);
  const s=group.players[0].round.holes[0].shots[0];
  assert.deepEqual(s.start,start);assert.equal(s.start.accuracy,7);assert.deepEqual(s.originalEnd,originalEnd);
  assert.equal(s.positionSource.end,'MANUAL_DROP');assert.equal(s.end.accuracy,null);
  assert.equal(s.editHistory.length,2);assert.deepEqual(s.editHistory[1].previous.end,originalEnd);
  assert.equal(s.editHistory[1].type,'END_POSITION_CORRECTED');
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  group=lesson.recordShot(group,pid,engine);assert.equal(group.players[0].round.holes[0].shots.length,2);
});
test('Phase 3B: 과거 여러 Pending/기존 확인 Draft의 누락 End를 역추정하지 않음',()=>{
  const engine=services(),store=memory();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,mapPoint(),engine);const first=structuredClone(group.players[0].round.holes[0].shots[0]);
  group=physical(group,pid,gpsPoint(),engine);
  group.players[0].round.holes[0].shots[0]=first; // A saved Phase 3A backlog.
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,{...mapPoint(),lng:106.879}),pid,engine);
  assert.deepEqual(group.players[0].round.holes[0].shots[0],first);
  assert.equal(group.players[0].round.holes[0].shots[1].end.lng,106.879);
  group=lesson.recordShot(group,pid,engine);lesson.saveGroup(store,group);
  const restored=lesson.restoreGroup(store);assert.deepEqual(restored.players[0].round.holes[0].shots[0],first);
  let oldDraft=registeredGroup(1,engine);const oldPid=oldDraft.players[0].playerId;
  oldDraft=lesson.confirmPosition(lesson.stagePosition(oldDraft,oldPid,mapPoint()),oldPid,engine);
  oldDraft=lesson.recordShot(oldDraft,oldPid,engine);
  const unchanged=structuredClone(oldDraft.players[0].round.holes[0].shots[0]);
  oldDraft.players[0].shotDraft={hole:1,club:'DR',position:{...gpsPoint(),confirmedAt:1234},confirmed:true,confirmationId:'clpos_LEGACY'};
  oldDraft=lesson.recordShot(oldDraft,oldPid,engine);assert.deepEqual(oldDraft.players[0].round.holes[0].shots[0],unchanged);
});
test('Phase 3B: ON GREEN은 선수 A만 변경하고 End/Putting 준비만 저장, PIN 없음 허용',()=>{
  const engine=services();let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=physical(group,a.playerId,mapPoint(),engine);group=physical(group,b.playerId,gpsPoint(),engine);
  const before=structuredClone(group),shotId=group.players[0].round.pending.id;
  group=lesson.onGreen(group,a.playerId,shotId,greenPoint(),null,engine);
  const p=group.players[0],h=p.round.holes[0],s=h.shots[0];
  assert.deepEqual(group.players[1],before.players[1]);assert.equal(h.shots.length,1);assert.equal(h.putts,0);assert.equal(h.completed,false);
  assert.equal(s.endLie,'GREEN');assert.equal(s.endState,'ON_GREEN');assert.equal(s.holed,false);assert.equal(s.sg,null);
  assert.equal(h.puttingReady.firstPuttDistanceM,null);assert.equal(h.puttingState,null);assert.equal(h.lessonStatus,'AWAITING_PUTTING');
  assert.equal(p.round.pending,null);assert.deepEqual(p.ballPosition,s.end);assert.equal(group.holePins,undefined);
  assert.throws(()=>lesson.recordShot(group,a.playerId,engine),/Phase 3C/);
  assert.throws(()=>lesson.stagePosition(group,a.playerId,mapPoint()),/Phase 3C/);
  assert.throws(()=>lesson.onGreen(group,a.playerId,shotId,greenPoint(),null,engine));
  assert.equal(before.players[0].round.holes[0].shots[0].status,'PENDING_RESULT');
});
test('Phase 3B: 공유 수동 PIN은 홀별 저장, B의 PIN 건너뛰기는 기존 PIN과 퍼팅 거리 규칙 유지',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=physical(group,a.playerId,mapPoint(),engine);group=physical(group,b.playerId,gpsPoint(),engine);
  group=lesson.onGreen(group,a.playerId,group.players[0].round.pending.id,greenPoint(),pinPoint(),engine);
  const shared=structuredClone(group.holePins['1']),aBefore=structuredClone(group.players[0]);
  assert.equal(shared.source,'SCORER_MANUAL_MAP');assert.equal(shared.isSurveyed,false);assert.equal(shared.groupId,group.groupId);
  group=lesson.selectPlayer(group,b.playerId);
  group=lesson.onGreen(group,b.playerId,group.players[1].round.pending.id,{...greenPoint(),lat:-6.4557},null,engine);
  assert.deepEqual(group.holePins['1'],shared);assert.deepEqual(group.players[0],aBefore);
  assert.ok(group.players.every(p=>p.round.holes[0].puttingReady.firstPuttDistanceM===null&&p.round.holes[0].shots[0].courseContext.endGreenDistanceM===null));
  group=lesson.chooseHole(group,b.playerId,2);group=physical(group,b.playerId,mapPoint(),engine);
  group=lesson.onGreen(group,b.playerId,group.players[1].round.pending.id,greenPoint(),null,engine);
  assert.equal(group.holePins['2'],undefined);assert.deepEqual(group.holePins['1'],shared);
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
});
test('Phase 3B: Green/PIN 밖 좌표, 없는 GI Green, 잘못된 PIN Source와 오래된 Shot ID 저장 거부',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,mapPoint(),engine);const shotId=group.players[0].round.pending.id,before=structuredClone(group);
  assert.throws(()=>lesson.onGreen(group,pid,shotId,mapPoint(),null,engine),/GI Green 안/);
  assert.throws(()=>lesson.onGreen(group,pid,shotId,gpsPoint(),null,engine));
  assert.throws(()=>lesson.onGreen(group,pid,shotId,greenPoint(),{...pinPoint(),lat:-6.5},engine),/PIN/);
  assert.throws(()=>lesson.onGreen(group,pid,shotId,greenPoint(),{...pinPoint(),source:'GPS'},engine),/SCORER_MANUAL_MAP/);
  assert.throws(()=>lesson.onGreen(group,pid,shotId,greenPoint(),null,{...engine,greenGeometry:()=>null}),/GI Green Polygon/);
  assert.throws(()=>lesson.onGreen(group,pid,'stale',greenPoint(),null,engine),/Pending Shot/);
  assert.deepEqual(group,before);
});
for(const club of ['DR','7I','PW','SW'])test('Phase 3B '+club+' HOLED: 추가 타수/Putting/좌표 추정 없이 선택 선수만 완료',()=>{
  const engine=services();engine.clubs.push('PW','SW');let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=lesson.setShotClub(group,a.playerId,club,engine);group=physical(group,a.playerId,gpsPoint(),engine);
  const beforeB=structuredClone(group.players[1]),shotId=group.players[0].round.pending.id;
  group=lesson.holed(group,a.playerId,shotId,engine);
  const p=group.players[0],h=p.round.holes[0],s=h.shots[0];
  assert.equal(h.shots.length,1);assert.equal(h.putts,0);assert.equal(h.score,1);assert.equal(h.completed,true);
  assert.equal(s.holed,true);assert.equal(s.endLie,'HOLED');assert.equal(s.endState,'HOLED');assert.equal(s.end,null);assert.equal(s.distanceM,null);
  assert.equal(s.result.endExpectedStrokes,0);assert.equal(s.courseContext.endGreenDistanceM,0);assert.equal(s.sg,null);
  assert.equal(p.round.pending,null);assert.deepEqual(group.players[1],beforeB);
  assert.throws(()=>lesson.holed(group,a.playerId,shotId,engine),/완료/);
  assert.throws(()=>lesson.recordShot(group,a.playerId,engine),/완료/);
  group=lesson.chooseHole(group,a.playerId,2);group=physical(group,a.playerId,mapPoint(),engine);
  assert.equal(group.players[0].round.holes[1].shots[0].shotSequence,1);
});
test('Phase 3B: HOLED Score는 기존 Physical Shot + Putting + Penalty 규칙 유지, 완료 상태 저장/복원',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=physical(group,a.playerId,mapPoint(),engine);group=physical(group,a.playerId,gpsPoint(),engine);
  group.players[0].round.holes[0].penalties=1;
  group=lesson.holed(group,a.playerId,group.players[0].round.pending.id,engine);
  group=physical(group,b.playerId,mapPoint(),engine);
  group=lesson.onGreen(group,b.playerId,group.players[1].round.pending.id,greenPoint(),pinPoint(),engine);
  assert.equal(group.players[0].round.holes[0].score,3);assert.equal(group.players[0].round.holes[0].shots.length,2);
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');assert.equal(store.getItem('jgi_completed_rounds_v1'),'unchanged-history');
  const wrong=structuredClone(group);wrong.players[0].round.holes[0].score=2;assert.throws(()=>lesson.validateGroup(wrong));
});
test('Green Popup: 같은 Map/이벤트 재사용, 후보 취소, 늦은 close/resize 무시, 저장 후 원래 위성 화면 복귀',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  const engine=services();let group=registeredGroup(2,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,mapPoint(),engine);
  const frames=[],closed=[],polygons=[],nodes=new Map(),classes=new Set();
  class Element{
    constructor(id){this.id=id;this.events={};this.children=[];this.open=false;}
    addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
    emit(type,event={}){for(const fn of this.events[type]||[])fn(event);}
    append(n){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);this.children.push(n);n.parentElement=this;}
    replaceChildren(){this.children=[];}
    setAttribute(){}
    showModal(){this.open=true;}
    close(){this.open=false;closed.push(()=>this.emit('close'));}
  }
  const el=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  class Marker{setMap(m){this.map=m;}setPosition(){}setLabel(){}setZIndex(){}setIcon(){}}
  class Polygon{constructor(options){this.paths=options.paths;this.map=options.map;polygons.push(this);}setMap(m){this.map=m;}}
  class Bounds{constructor(){this.points=[];}extend(p){this.points.push(p);}}
  const map={listeners:[],fits:[],addListener(type,fn){this.listeners.push(fn);},fitBounds(bounds){this.fits.push(bounds.points);}};
  const context={window:{JGI_COURSE_LESSON_MAP:{},activeCourseData:()=>({holes:{'1':{t:[0,0],g:[1,1]},'2':{t:[0,0],g:[2,2]}}}),
      courseViewProjector:()=>({shapes:[],project:p=>({x:p.lng,y:p.lat,inside:true})}),
      courseLocalProjector:()=>({toXY:p=>({x:p.lng,y:p.lat}),toLatLng:p=>({lat:p.y,lng:p.x})}),svgPath:()=>''},
    document:{getElementById:el,createElementNS:()=>new Element(),body:{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}}},
    google:{maps:{Marker,Polygon,LatLngBounds:Bounds,SymbolPath:{CIRCLE:0},event:{trigger(){}}}},requestAnimationFrame:fn=>frames.push(fn),Date};
  vm.runInNewContext(fs.readFileSync(require.resolve('../course-lesson-map.js'),'utf8'),context);
  let saved=null;
  const controller=context.window.JGICourseLessonMapController({querySelector:s=>el(s.slice(1))},()=>group,()=>assert.fail('Popup click must not stage a main-map position'),{
    geometry:(r,hole)=>lesson.greenGeometry(r,hole,engine),contains:lesson.pointInGreen,
    onSave:(ctx,point,pin)=>{saved={ctx,point,pin};group=lesson.onGreen(group,ctx.playerId,ctx.shotId,point,pin,engine);controller.render();}
  });
  controller.attach(map);controller.attach(map);assert.equal(map.listeners.length,1);el('lessonSatellite').emit('click');
  const open=(shotId=group.players[0].round.pending.id)=>controller.openGreen({groupId:group.groupId,playerId:pid,hole:group.players[0].round.currentHole,shotId});
  const click=point=>map.listeners[0]({latLng:{lat:()=>point.lat,lng:()=>point.lng}});
  const before=structuredClone(group);open();click(greenPoint());el('lessonGreenPin').emit('click');click(pinPoint());
  assert.equal(el('googleMap').parentElement.id,'lessonGreenSatellite');assert.deepEqual(group,before);
  el('lessonGreenCancel').emit('click');assert.equal(el('googleMap').parentElement.id,'lessonSatelliteMap');
  assert.equal(el('lessonSatelliteMap').hidden,false);assert.ok(polygons.every(p=>p.map===null));assert.deepEqual(group,before);
  // Reopen a different hole before old close and resize callbacks are dispatched.
  group=lesson.chooseHole(group,pid,2);
  for(let i=0;i<4;i++)group=physical(group,pid,mapPoint(),engine);
  const historicalId=group.players[0].round.holes[1].shots[2].id;
  assert.throws(()=>open('missing'),/저장된 Shot/);
  open(historicalId);assert.match(el('lessonGreenTitle').textContent,/Shot 3/);
  for(const event of closed.splice(0))event();assert.equal(el('lessonGreenDialog').open,true);
  const priorFits=map.fits.length;for(const frame of frames.splice(0))frame();assert.equal(map.fits.length,priorFits+1);
  const beforeSave=structuredClone(group);click(mapPoint());assert.equal(el('lessonGreenSave').disabled,true);
  click(greenPoint());el('lessonGreenPin').emit('click');click(pinPoint());el('lessonGreenSkipPin').emit('click');
  el('lessonGreenSave').emit('click');
  assert.equal(saved.pin,null);assert.equal(saved.point.source,'MANUAL_DROP');assert.equal(saved.point.accuracy,null);
  assert.equal(el('lessonGreenDialog').open,false);assert.equal(el('googleMap').parentElement.id,'lessonSatelliteMap');
  assert.equal(el('lessonSatelliteMap').hidden,false);assert.equal(classes.size,0);assert.equal(map.listeners.length,1);assert.ok(polygons.every(p=>p.map===null));
  assert.deepEqual(group.players[1],beforeSave.players[1]);assert.equal(group.players[0].round.holes[1].shots.length,4);
  assert.equal(saved.ctx.shotId,historicalId);
  assert.deepEqual(group.players[0].round.holes[1].shots[3],beforeSave.players[0].round.holes[1].shots[3]);
  assert.deepEqual(group.players[0].round.pending,beforeSave.players[0].round.pending);
});
