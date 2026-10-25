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
function puttingFixture(count=2){
  const engine=services();let group=registeredGroup(count,engine);
  for(const player of group.players){
    group=lesson.selectPlayer(group,player.playerId);
    for(let i=0;i<3;i++)group=physical(group,player.playerId,mapPoint(),engine);
    group=lesson.onGreen(group,player.playerId,group.players.find(p=>p.playerId===player.playerId).round.pending.id,greenPoint(),null,engine);
  }
  return {engine,group:lesson.selectPlayer(group,group.players[0].playerId)};
}
function putt(group,pid,distance,result,engine){
  group=lesson.selectPlayer(group,pid);
  const p=group.players.find(p=>p.playerId===pid),hole=p.round.currentHole;
  group=lesson.setPuttDistance(group,pid,hole,String(distance),engine);
  const h=group.players.find(p=>p.playerId===pid).round.holes[hole-1];
  return lesson.recordPutt(group,pid,hole,h.puttsDetail.length+1,h.puttingReady.inputId,result,engine);
}
for(const order of [[0],[0,1],[1,0],[1,2,0],[3,1,0,2]])test('AUTO NEXT HOLE 완료 순서 '+order.join(' → ')+': 마지막 등록 선수만 이동, 기록/선택/Tee 보존',()=>{
  const {engine,...fixture}=puttingFixture(order.length);let group=fixture.group;
  const store=memory(),original=structuredClone(group),writes=[];
  const recordingStore={...store,setItem:(key,value)=>{writes.push(JSON.parse(value));store.setItem(key,value);}};
  for(const [i,index] of order.entries()){
    const pid=group.players[index].playerId;
    const completed=putt(group,pid,1,'HOLED',engine),before=structuredClone(completed);
    const result=lesson.saveHoleCompletion(recordingStore,completed,1,engine);group=result.group;
    assert.equal(group.selectedPlayerId,pid);assert.deepEqual(completed,before);
    assert.equal(group.players[index].round.holes[0].score,4);
    if(i<order.length-1){
      assert.equal(result.message,null);assert.ok(group.players.every(p=>p.round.currentHole===1));
      for(const p of group.players)if(!p.round.holes[0].completed)assert.equal(p.round.holes[0].puttingReady.status,'AWAITING_INPUT');
    }else{
      assert.equal(result.message,'HOLE 1 COMPLETE → HOLE 2');
      assert.equal(writes.at(-2).players[index].round.currentHole,1);
      assert.equal(writes.at(-2).players[index].round.holes[0].puttsDetail.at(-1).result,'HOLED');
      assert.ok(writes.at(-2).players.every(p=>p.round.holes[0].completed));
      for(const [j,p] of group.players.entries()){
        assert.equal(p.round.currentHole,2);assert.deepEqual(p.round.holes,before.players[j].round.holes);
        assert.deepEqual(p.profile,original.players[j].profile);assert.equal(p.round.tee,original.players[j].round.tee);
        assert.equal(p.ballPosition,null);assert.equal(p.shotDraft.position,null);assert.equal(p.shotDraft.confirmed,false);
        assert.equal(p.shotDraft.hole,2);assert.equal(p.round.pending,null);
      }
      assert.deepEqual(lesson.advanceCompletedHole(group,1,engine).group,group);
      assert.throws(()=>lesson.recordPutt(group,pid,1,1,before.players[index].round.holes[0].puttsDetail[0].inputId,'HOLED',engine),/PUTTING READY/);
    }
    assert.deepEqual(lesson.restoreGroup(store),group);
  }
  const review=lesson.chooseHole(group,group.selectedPlayerId,1);
  assert.equal(review.players.find(p=>p.playerId===group.selectedPlayerId).round.holes[0].score,4);
  const next=physical(group,group.selectedPlayerId,mapPoint(),engine),player=next.players.find(p=>p.playerId===next.selectedPlayerId);
  assert.equal(player.round.holes[1].shots[0].shotSequence,1);assert.equal(player.round.holes[1].shots[0].previousShotId,undefined);
  assert.deepEqual(player.round.holes[0],group.players.find(p=>p.playerId===next.selectedPlayerId).round.holes[0]);
});
test('AUTO NEXT HOLE Physical HOLED, 미등록 제외, 공유 PIN/다른 선수 데이터 보존',()=>{
  const engine=services(),store=memory();let group=registeredGroup(1,engine);
  const empty=lesson.createGroup(1,engine).players[0]; // Use separate IDs for the unregistered slot.
  empty.playerId='clp_TEST_UNREGISTERED';empty.roundId='clr_TEST_UNREGISTERED';group.players.push(empty);
  const pid=group.players[0].playerId;
  group.holePins={'1':{...pinPoint(),hole:1,groupId:group.groupId,isSurveyed:false}};
  group=physical(group,pid,mapPoint(),engine);const id=group.players[0].round.pending.id;
  const completed=lesson.holed(group,pid,id,engine),before=structuredClone(completed);
  group=lesson.saveHoleCompletion(store,completed,1,engine).group;
  assert.equal(group.players[0].round.currentHole,2);assert.deepEqual(group.players[1],before.players[1]);
  assert.deepEqual(group.holePins,before.holePins);assert.deepEqual(group.players[0].round.holes[0],before.players[0].round.holes[0]);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');assert.equal(store.getItem('jgi_completed_rounds_v1'),'unchanged-history');
});
test('AUTO NEXT HOLE 저장 순서/실패: 완료 기록을 먼저 보존하고 이동 실패 시 현재 홀 유지',()=>{
  const engine=services(),store=memory();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,mapPoint(),engine);const completed=lesson.holed(group,pid,group.players[0].round.pending.id,engine);
  let writes=0;
  const result=lesson.saveHoleCompletion({...store,setItem:(k,v)=>{if(++writes===2)throw new Error('TEST_QUOTA');store.setItem(k,v);}},completed,1,engine);
  assert.equal(result.error,true);assert.match(result.message,/완료 저장됨.*TEST_QUOTA/);
  assert.deepEqual(result.group,completed);assert.deepEqual(lesson.restoreGroup(store),completed);
  assert.throws(()=>lesson.saveHoleCompletion({setItem:()=>{throw new Error('TEST_FIRST_SAVE');}},completed,1,engine),/TEST_FIRST_SAVE/);
});
test('AUTO NEXT HOLE 지난 홀 정정/다른 Current Hole: 완료 조건을 다시 만족해도 이후 기록은 초기화하지 않음',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);
  const [a,b]=group.players;
  for(const pid of [a.playerId,b.playerId]){
    group=lesson.selectPlayer(group,pid);group=physical(group,pid,mapPoint(),engine);
    group=lesson.saveHoleCompletion(store,lesson.holed(group,pid,group.players.find(p=>p.playerId===pid).round.pending.id,engine),1,engine).group;
  }
  group=physical(group,b.playerId,mapPoint(),engine);
  group=lesson.selectPlayer(group,a.playerId);group=lesson.chooseHole(group,a.playerId,1);
  const id=group.players[0].round.holes[0].shots[0].id;
  group=lesson.cancelResult(group,a.playerId,id,engine);
  assert.equal(group.players[0].round.holes[0].completed,false);assert.equal(group.players[1].round.currentHole,2);
  assert.equal(lesson.advanceCompletedHole(group,1,engine).message,null);
  group=lesson.chooseHole(group,b.playerId,1);
  const completed=lesson.holed(group,a.playerId,id,engine),before=structuredClone(completed);
  const result=lesson.saveHoleCompletion(store,completed,1,engine);
  assert.match(result.message,/이후 홀 기록/);assert.deepEqual(result.group,before);
  assert.equal(result.group.players[1].round.holes[1].shots.length,1);
});
test('AUTO NEXT HOLE 지난 홀 완료 정정이 미해결이면 다음 홀 전원 HOLED도 자동 진행 차단',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);const [a,b]=group.players;
  for(const pid of [a.playerId,b.playerId]){
    group=lesson.selectPlayer(group,pid);group=physical(group,pid,mapPoint(),engine);
    group=lesson.saveHoleCompletion(store,lesson.holed(group,pid,group.players.find(p=>p.playerId===pid).round.pending.id,engine),1,engine).group;
  }
  group=lesson.selectPlayer(group,a.playerId);group=lesson.chooseHole(group,a.playerId,1);
  group=lesson.cancelResult(group,a.playerId,group.players[0].round.holes[0].shots[0].id,engine);
  group=lesson.chooseHole(group,a.playerId,2);
  for(const pid of [a.playerId,b.playerId]){
    group=lesson.selectPlayer(group,pid);group=physical(group,pid,mapPoint(),engine);
    group=lesson.holed(group,pid,group.players.find(p=>p.playerId===pid).round.pending.id,engine);
  }
  const before=structuredClone(group),result=lesson.saveHoleCompletion(store,group,2,engine);
  assert.match(result.message,/지난 홀의 완료 상태/);assert.deepEqual(result.group,before);
  assert.ok(result.group.players.every(p=>p.round.currentHole===2));assert.equal(result.group.players[0].round.holes[0].completed,false);
});
for(const putting of [false,true])test('HOLE 18 '+(putting?'Putting':'Physical Shot')+' 전원 완료 → ROUND COMPLETE, 이동/기록 변경 없음',()=>{
  const engine=services(),store=memory();let group=registeredGroup(2,engine);
  for(const player of group.players)group=lesson.chooseHole(group,player.playerId,18);
  for(const player of group.players){
    group=lesson.selectPlayer(group,player.playerId);group=lesson.chooseHole(group,player.playerId,18);
    group=physical(group,player.playerId,mapPoint(),engine);
    const id=group.players.find(p=>p.playerId===player.playerId).round.pending.id;
    if(putting){group=lesson.onGreen(group,player.playerId,id,greenPoint(),null,engine);group=putt(group,player.playerId,1,'HOLED',engine);}
    else group=lesson.holed(group,player.playerId,id,engine);
    const before=structuredClone(group),result=lesson.saveHoleCompletion(store,group,18,engine);group=result.group;
    assert.ok(group.players.every(p=>p.round.currentHole===18));
    for(const [i,p] of group.players.entries())assert.deepEqual(p.round.holes,before.players[i].round.holes);
    if(player.playerId===group.players[1].playerId){
      assert.equal(result.message,'ROUND COMPLETE');assert.ok(group.players.every(p=>p.round.lessonRoundStatus==='COMPLETED'));
    }
  }
  assert.deepEqual(lesson.restoreGroup(store),group);
});
for(const sequence of [[0,0,1,1],[0,1,0,1],[1,1,0,0],[0,1,2,3,3,2,1,0]])
test('Phase 3C 자유 순서 '+sequence.join(' → ')+': 선수 독립·HOLE OUT·Score·Raw Data·복원',()=>{
  const {engine,...fixture}=puttingFixture(Math.max(...sequence)+1);let group=fixture.group;
  const initial=structuredClone(group),store=memory();
  for(const index of sequence){
    const previous=structuredClone(group);
    const p=group.players[index],count=p.round.holes[0].putts;
    group=putt(group,p.playerId,count===0?8:1,count===0?'SHORT':'HOLED',engine);
    assert.equal(group.selectedPlayerId,p.playerId);
    for(const [j,other] of group.players.entries())if(j!==index)assert.deepEqual(other,previous.players[j]);
    lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  }
  for(const [index,p] of group.players.entries()){
    const h=p.round.holes[0];assert.equal(h.putts,2);assert.equal(h.score,5);assert.equal(h.completed,true);
    assert.deepEqual(h.shots,initial.players[index].round.holes[0].shots);assert.deepEqual(p.ballPosition,initial.players[index].ballPosition);
    assert.deepEqual(h.puttsDetail.map(putt=>[putt.number,putt.distanceM,putt.result]),[[1,8,'SHORT'],[2,1,'HOLED']]);
    assert.ok(h.puttsDetail.every(putt=>putt.playerId===p.playerId&&putt.hole===1&&putt.sg===null));
  }
  assert.equal(group.holePins,undefined);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');assert.equal(store.getItem('jgi_completed_rounds_v1'),'unchanged-history');
});
for(const count of [1,2,3])test('Phase 3C '+count+'퍼팅 Score, LONG 대기 및 거리만 입력 시 타수 불변',()=>{
  const {engine,...fixture}=puttingFixture(1);let group=fixture.group;const pid=group.players[0].playerId;
  for(let i=1;i<=count;i++){
    group=lesson.setPuttDistance(group,pid,1,String(i===1?8:1),engine);
    const h=group.players[0].round.holes[0];assert.equal(h.putts,i-1);assert.equal(h.shots.length,3);
    group=lesson.recordPutt(group,pid,1,i,h.puttingReady.inputId,i===count?'HOLED':'LONG',engine);
    assert.equal(group.players[0].round.holes[0].putts,i);
    if(i<count)assert.equal(group.players[0].round.holes[0].puttingReady.distanceM,null);
  }
  const h=group.players[0].round.holes[0];assert.equal(h.score,3+count);assert.equal(h.completed,true);
  assert.throws(()=>lesson.setPuttDistance(group,pid,1,'1',engine),/PUTTING READY/);
});
test('Phase 3C 거리 Draft는 선수/홀별 독립 저장, PIN 거리로 덮어쓰지 않음',()=>{
  const {engine,...fixture}=puttingFixture();let group=fixture.group;const [a,b]=group.players;
  group=lesson.setPuttDistance(group,a.playerId,1,'8.25',engine);
  group=lesson.selectPlayer(group,b.playerId);group=lesson.setPuttDistance(group,b.playerId,1,'2.5',engine);
  group=lesson.selectPlayer(group,a.playerId);
  assert.equal(group.players[0].round.holes[0].puttingReady.distanceInput,'8.25');
  assert.equal(group.players[0].round.holes[0].puttingReady.distanceM,8.3);
  assert.equal(group.players[1].round.holes[0].puttingReady.distanceM,2.5);
  group=lesson.chooseHole(group,a.playerId,2);assert.equal(group.players[0].round.currentHole,2);
  assert.throws(()=>lesson.setPuttDistance(group,a.playerId,1,'1',engine),/PUTTING READY/);
  group=lesson.chooseHole(group,a.playerId,1);
  const store=memory();lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  assert.equal(group.players[0].round.holes[0].putts,0);
});
test('Phase 3C 공유 PIN/기존 ON GREEN 복원 유지 및 기존 퍼팅 충돌 거부',()=>{
  const {engine,...fixture}=puttingFixture(1);let group=fixture.group;const pid=group.players[0].playerId;
  group.holePins={'1':{...pinPoint(),hole:1,groupId:group.groupId,isSurveyed:false}};
  const pins=structuredClone(group.holePins),store=memory();
  lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  assert.equal(group.players[0].round.holes[0].puttingReady.distanceInput,undefined);
  group=lesson.setPuttDistance(group,pid,1,'12',engine);
  assert.equal(group.players[0].round.holes[0].puttingReady.distanceM,12);assert.deepEqual(group.holePins,pins);
  group=putt(group,pid,12,'HOLED',engine);assert.deepEqual(group.holePins,pins);
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  const conflict=puttingFixture(1).group;conflict.players[0].round.holes[0].putts=1;
  assert.throws(()=>lesson.setPuttDistance(conflict,conflict.players[0].playerId,1,'1',engine),/기존 퍼팅 기록/);
});
test('Phase 3C 입력 없음/오류/중복 터치/늦은 이벤트 및 후속 취소 차단',()=>{
  const {engine,...fixture}=puttingFixture();let group=fixture.group;const [a,b]=group.players;
  for(const raw of ['','0','-1','NaN','Infinity','1e308']){
    group=lesson.setPuttDistance(group,a.playerId,1,raw,engine);
    assert.equal(group.players[0].round.holes[0].puttingReady.distanceM,null);
    assert.throws(()=>lesson.recordPutt(group,a.playerId,1,1,null,'SHORT',engine),/거리 입력/);
  }
  group=lesson.setPuttDistance(group,a.playerId,1,'8',engine);
  const token=group.players[0].round.holes[0].puttingReady.inputId,before=structuredClone(group);
  assert.throws(()=>lesson.recordPutt(group,a.playerId,1,1,token,'TAP_IN',engine));assert.deepEqual(group,before);
  const switched=lesson.selectPlayer(group,b.playerId);
  assert.throws(()=>lesson.recordPutt(switched,a.playerId,1,1,token,'SHORT',engine),/선택 선수/);
  group=lesson.recordPutt(group,a.playerId,1,1,token,'SHORT',engine);
  assert.throws(()=>lesson.recordPutt(group,a.playerId,1,1,token,'SHORT',engine),/이미 저장/);
  group=lesson.setPuttDistance(group,a.playerId,1,'1',engine);
  assert.throws(()=>lesson.recordPutt(group,a.playerId,1,2,token,'HOLED',engine),/이미 저장/);
  const h=group.players[0].round.holes[0],shotId=h.shots.at(-1).id,unchanged=structuredClone(group);
  assert.throws(()=>lesson.undoLastShot(group,a.playerId,shotId,engine),/후속 기록/);
  assert.throws(()=>lesson.cancelResult(group,a.playerId,shotId,engine),/후속 기록/);
  assert.deepEqual(group,unchanged);
  group=lesson.recordPutt(group,a.playerId,1,2,h.puttingReady.inputId,'HOLED',engine);
  assert.throws(()=>lesson.recordPutt(group,a.playerId,1,3,h.puttingReady.inputId,'HOLED',engine),/PUTTING READY/);
  for(const mutate of [h=>h.putts++,h=>h.score++,h=>h.puttsDetail[0].playerId=b.playerId,h=>h.puttsDetail[1].id=h.puttsDetail[0].id,h=>h.puttsDetail[0].sg=0]){
    const corrupt=structuredClone(group);mutate(corrupt.players[0].round.holes[0]);assert.throws(()=>lesson.validateGroup(corrupt));
  }
});
function undoFixture(legacy=false){
  const engine=services();engine.clubs.push('3W','58°');engine.now=(()=>{let t=1234;return ()=>++t;})();
  let group=registeredGroup(2,engine);const [a,b]=group.players;
  const beforeLink=[];
  for(const p of [a,b]){
    group=lesson.selectPlayer(group,p.playerId);
    for(const club of ['DR','3W','58°','DR']){
      group=lesson.setShotClub(group,p.playerId,club,engine);
      if(club==='DR'&&group.players.find(x=>x.playerId===p.playerId).round.holes[0].shots.length===3)
        beforeLink.push(structuredClone(group.players.find(x=>x.playerId===p.playerId).round.holes[0].shots[2]));
      group=physical(group,p.playerId,mapPoint(),engine);
    }
    const shot=group.players.find(x=>x.playerId===p.playerId).round.holes[0].shots[3];
    group=lesson.onGreen(group,p.playerId,shot.id,greenPoint(),pinPoint(),engine);
  }
  if(legacy)for(const p of group.players)for(const shot of p.round.holes[0].shots)
    for(const e of shot.editHistory)e.previous={end:e.previous.end,endLie:e.previous.endLie,endState:e.previous.endState||null,status:e.previous.status,result:e.previous.result};
  group=lesson.selectPlayer(group,a.playerId);
  return {engine,group,pid:a.playerId,beforeLink};
}
for(const legacy of [false,true])test('UNDO Shot 4 ON_GREEN: '+(legacy?'기존 축약 이력':'새 이력')+' 복구, A/B·PIN 보존, Shot 3 ON GREEN 재입력',()=>{
  const {engine,pid,beforeLink,...fixture}=undoFixture(legacy);let group=fixture.group;
  const store=memory();lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  const before=structuredClone(group),id=group.players[0].round.holes[0].shots[3].id;
  group=lesson.undoLastShot(group,pid,id,engine);
  const p=group.players[0],h=p.round.holes[0],shot=h.shots[2];
  assert.equal(h.shots.length,3);assert.equal(h.completed,false);assert.equal(h.puttingReady,null);
  assert.equal(shot.status,'PENDING_RESULT');assert.equal(p.round.pending.id,shot.id);
  const {editHistory,...actual}=shot,{editHistory:oldHistory,...expected}=beforeLink[0];
  assert.deepEqual(actual,expected);assert.equal(editHistory.at(-1).type,'SHOT_LINK_UNDONE');
  assert.deepEqual(group.players[1],before.players[1]);assert.deepEqual(group.holePins,before.holePins);
  assert.throws(()=>lesson.undoLastShot(group,pid,id,engine),/Physical Shot/);
  group=lesson.onGreen(group,pid,shot.id,greenPoint(),null,engine);
  assert.equal(group.players[0].round.holes[0].shots.length,3);
  assert.equal(group.players[0].round.holes[0].puttingReady.entryShotId,shot.id);
  lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');
  assert.equal(store.getItem('jgi_completed_rounds_v1'),'unchanged-history');
});
for(const type of ['ON_GREEN','HOLED'])for(const legacy of [false,true])test('RESULT CANCEL '+type+' / legacy='+legacy+': Physical Shot 유지 및 홀/Pending 복구',()=>{
  const fixture=undoFixture(legacy),{engine,pid}=fixture;let group=fixture.group;
  const id=group.players[0].round.holes[0].shots[3].id;
  if(type==='HOLED'){
    group=lesson.cancelResult(group,pid,id,engine);group=lesson.holed(group,pid,id,engine);
  }
  const before=structuredClone(group),hbefore=before.players[0].round.holes[0];
  group=lesson.cancelResult(group,pid,id,engine);
  const p=group.players[0],h=p.round.holes[0],shot=h.shots[3];
  assert.equal(h.shots.length,4);assert.equal(shot.id,id);assert.deepEqual(shot.start,hbefore.shots[3].start);
  assert.deepEqual(h.shots.slice(0,3),hbefore.shots.slice(0,3));
  assert.equal(shot.result,null);assert.equal(shot.end,null);assert.equal(shot.holed,false);
  assert.equal(shot.status,'PENDING_RESULT');assert.equal(p.round.pending.id,id);
  assert.equal(h.completed,false);assert.equal(h.puttingReady,null);assert.equal(h.score,undefined);
  assert.equal(h.completedAt,undefined);assert.equal(lesson.resultTargetShot(p,id).id,id);
  assert.deepEqual(group.players[1],before.players[1]);assert.deepEqual(group.holePins,before.holePins);
  assert.throws(()=>lesson.cancelResult(group,pid,id,engine),/ON GREEN/);
  const store=memory();lesson.saveGroup(store,group);assert.deepEqual(lesson.restoreGroup(store),group);
});
test('UNDO HOLED / 단일 Pending / 반복 취소 후 재기록: 타수와 중복 연결 없음',()=>{
  const {engine,pid,...fixture}=undoFixture();let group=fixture.group;
  const id=group.players[0].round.holes[0].shots[3].id;
  group=lesson.holed(lesson.cancelResult(group,pid,id,engine),pid,id,engine);
  group=lesson.undoLastShot(group,pid,id,engine);
  assert.equal(group.players[0].round.holes[0].completed,false);
  group=physical(group,pid,gpsPoint(),engine);
  assert.equal(group.players[0].round.holes[0].shots.length,4);
  group=lesson.undoLastShot(group,pid,group.players[0].round.pending.id,engine);
  assert.equal(group.players[0].round.holes[0].shots[2].end,null);
  for(let i=0;i<3;i++)group=lesson.undoLastShot(group,pid,group.players[0].round.holes[0].shots.at(-1).id,engine);
  assert.equal(group.players[0].round.holes[0].shots.length,0);assert.equal(group.players[0].round.pending,null);
  assert.equal(group.players[0].round.startedAt,null);assert.equal(group.players[0].ballPosition,null);
  assert.equal(group.players[0].round.lessonRoundStatus,'REGISTERED');
  group=physical(group,pid,mapPoint(),engine);assert.equal(group.players[0].round.holes[0].shots[0].shotSequence,1);
});
test('Undo는 여러 번 재확인한 자동 End 연결 전체를 복구하고 결과 취소는 기존 연결 End만 복구',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.players[0].playerId;
  group=physical(group,pid,gpsPoint(),engine);
  const original=structuredClone(group.players[0].round.holes[0].shots[0]);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,mapPoint()),pid,engine);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,gpsPoint()),pid,engine);
  const linked=structuredClone(group.players[0].round.holes[0].shots[0]);
  const linkedGroup=structuredClone(group);
  group=lesson.recordShot(group,pid,engine);
  group=lesson.undoLastShot(group,pid,group.players[0].round.pending.id,engine);
  const {editHistory:undoHistory,...undone}=group.players[0].round.holes[0].shots[0],{editHistory:initialHistory,...before}=original;
  assert.deepEqual(undone,before);
  group=linkedGroup;
  group=lesson.onGreen(group,pid,linked.id,greenPoint(),null,engine);
  group=lesson.cancelResult(group,pid,linked.id,engine);
  const {editHistory,...restored}=group.players[0].round.holes[0].shots[0],{editHistory:prior,...expected}=linked;
  assert.deepEqual(restored,expected);assert.equal(group.players[0].round.holes[0].shots.length,1);
  group=lesson.confirmPosition(lesson.stagePosition(group,pid,mapPoint()),pid,engine);
  group=lesson.recordShot(group,pid,engine);
  group=lesson.undoLastShot(group,pid,group.players[0].round.pending.id,engine);
  const {editHistory:afterHistory,...after}=group.players[0].round.holes[0].shots[0];
  assert.deepEqual(after,expected);
});
for(const conflict of ['putts','puttsDetail','penalties','penaltyEvents','puttingState','distance','nextHole','specialEvent','draft','review','missingHistory','changedHistory','missingLink'])
test('취소 충돌 차단: '+conflict+' — 원본과 후속 기록 불변',()=>{
  const {engine,pid,...fixture}=undoFixture();const group=fixture.group,h=group.players[0].round.holes[0],id=h.shots[3].id;
  if(conflict==='putts'||conflict==='penalties')h[conflict]=1;
  if(conflict==='puttsDetail'||conflict==='penaltyEvents')h[conflict].push({id:'TEST_FOLLOWUP'});
  if(conflict==='puttingState')h.puttingState={status:'RECORDED'};
  if(conflict==='distance')h.puttingReady.firstPuttDistanceM=3;
  if(conflict==='nextHole')group.players[0].round.holes[1].shots.push({id:'TEST_NEXT_HOLE'});
  if(conflict==='specialEvent')group.players[0].round.specialEvents.push({hole:1});
  if(conflict==='draft')group.players[0].shotDraft.position=mapPoint();
  if(conflict==='review')h.review={id:'TEST_REVIEW'};
  if(conflict==='missingHistory'){h.shots[2].editHistory=[];h.shots[3].editHistory=[];}
  if(conflict==='changedHistory'){
    h.shots[2].result.confirmationId='CHANGED';h.shots[3].editHistory.at(-1).next.end=mapPoint();
  }
  if(conflict==='missingLink'){
    delete h.shots[3].previousShotId;h.shots[3].editHistory=[];
  }
  const before=structuredClone(group);
  assert.throws(()=>lesson.undoLastShot(group,pid,id,engine));assert.deepEqual(group,before);
  assert.throws(()=>lesson.cancelResult(group,pid,id,engine));assert.deepEqual(group,before);
});
test('취소 대상/선수/후속 Physical Shot 충돌 차단, 다른 선수 PIN 이용 유지',()=>{
  const {engine,pid,...fixture}=undoFixture();let group=fixture.group;
  const h=group.players[0].round.holes[0],id=h.shots[3].id,bid=group.players[1].playerId;
  assert.throws(()=>lesson.undoLastShot(group,pid,h.shots[2].id,engine),/마지막/);
  assert.throws(()=>lesson.undoLastShot(group,bid,group.players[1].round.holes[0].shots[3].id,engine),/선택 선수/);
  group=lesson.cancelResult(group,pid,id,engine);
  group=lesson.onGreen(group,pid,h.shots[2].id,greenPoint(),null,engine);
  const before=structuredClone(group);
  assert.throws(()=>lesson.cancelResult(group,pid,h.shots[2].id,engine),/후속 Physical Shot/);
  assert.deepEqual(group,before);
});
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
  assert.throws(()=>lesson.recordShot(group,a.playerId,engine),/퍼팅 거리/);
  assert.throws(()=>lesson.stagePosition(group,a.playerId,mapPoint()),/퍼팅 거리/);
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
test('Round/Course Lesson은 동일 기존 Google Map 초기화 설정을 사용하고 Lesson 클릭만 분리',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  const source=html.slice(html.indexOf('window.initGoogleMap=function(){'),html.indexOf('window.gm_authFailure=function(){'));
  for(const lessonMode of [false,true]){
    const node={},created=[],calls=[];
    class Map{constructor(el,options){created.push({el,options});}addListener(type){calls.push(type);}}
    const context={google:{maps:{Map,RenderingType:{VECTOR:'VECTOR'}}},googleMap:null,JAGORAWI_OLD_CENTER:{lat:1,lng:2},
      $:id=>id==='googleMap'?node:null,round:null,updatePlayerMarker:()=>calls.push('player'),renderCourseHole:()=>calls.push('round')};
    context.window=lessonMode?{google:context.google,JGI_COURSE_LESSON_MAP:{onReady:map=>calls.push(map)}}:{google:context.google};
    vm.createContext(context);vm.runInContext(source,context);context.window.initGoogleMap();
    assert.equal(created.length,1);assert.equal(created[0].el,node);assert.equal(created[0].options.mapTypeId,'satellite');
    if(lessonMode){
      assert.deepEqual(calls,[context.googleMap]);const session=context.googleMap;
      context.window.initGoogleMap();assert.equal(created.length,1);assert.equal(context.googleMap,session);
      assert.deepEqual(calls,[session,session]);
    }else assert.deepEqual(calls,['click','player','round']);
  }
});
test('Satellite 준비 연결: SDK 선로딩/기존 Session/콜백 전후/오류 유지와 복구 — 중복 Map 생성 없음',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../course-lesson.js'),'utf8');
  const bridge=source.slice(source.indexOf('  let sharedMap=null'),source.indexOf('  function boot(){'));
  for(const scenario of ['preloaded','existing','early','late','error']){
    const calls=[],session={},context={googleMap:null,googleMapsRequested:scenario==='late',controller:{attach:m=>calls.push(['attach',m]),unavailable:e=>calls.push(['error',e])}};
    context.window={google:{maps:{Map:function(){}}},initGoogleMap:()=>{calls.push(['init']);context.googleMap=session;context.window.JGI_COURSE_LESSON_MAP.onReady(session);}};
    vm.createContext(context);vm.runInContext(bridge,context);
    if(scenario==='early')context.window.JGI_COURSE_LESSON_MAP.onReady(session);
    if(scenario==='existing')context.googleMap=session;
    if(scenario==='error'){context.window.JGI_COURSE_LESSON_MAP.onReady(session);context.window.JGI_COURSE_LESSON_MAP.onError('TEST_AUTH_ERROR');}
    vm.runInContext('mapController=controller;attachExistingMap();',context);
    if(scenario==='late'){assert.equal(calls.length,0);context.window.JGI_COURSE_LESSON_MAP.onReady(session);}
    if(scenario==='error'){
      assert.deepEqual(calls,[['error','TEST_AUTH_ERROR']]);
      context.window.JGI_COURSE_LESSON_MAP.onReady(session);assert.equal(vm.runInContext('mapError',context),null);
    }
    assert.equal(calls.filter(c=>c[0]==='init').length,scenario==='preloaded'?1:0);
    assert.equal(calls.filter(c=>c[0]==='attach').length,1);assert.equal(calls.at(-1)[1],session);
  }
});
test('실제 gm_authFailure 경로 뒤에는 중복 init/onReady가 인증 실패를 지우거나 새 Map을 만들지 않음',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),html=fs.readFileSync(require.resolve('../index.html'),'utf8'),source=fs.readFileSync(require.resolve('../course-lesson.js'),'utf8');
  const events=[],node={};let constructions=0;
  class Map{constructor(){constructions++;}}
  const context={google:{maps:{Map,RenderingType:{VECTOR:'VECTOR'}}},googleMap:null,googleMapsRequested:true,
    JAGORAWI_OLD_CENTER:{lat:1,lng:2},$:id=>id==='googleMap'?node:null,window:{google:{maps:{Map}}},
    controller:{attach:map=>events.push(['attach',map]),unavailable:message=>events.push(['error',message])}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  let sharedMap=null'),source.indexOf('  function boot(){')),context);
  vm.runInContext('mapController=controller;',context);
  vm.runInContext(html.slice(html.indexOf('window.initGoogleMap=function(){'),html.indexOf('function loadGoogleMaps(){')),context);
  context.window.initGoogleMap();const session=context.googleMap;context.window.gm_authFailure();
  context.window.initGoogleMap();context.window.JGI_COURSE_LESSON_MAP.onReady(session);
  context.window.JGI_COURSE_LESSON_MAP.onError('TEST_LOAD_ERROR');vm.runInContext('attachExistingMap();',context);
  assert.equal(constructions,1);assert.equal(events.filter(e=>e[0]==='attach').length,1);
  assert.ok(events.filter(e=>e[0]==='error').every(e=>e[1].includes('Google Maps 인증 오류')));
  assert.equal(vm.runInContext('mapAuthFailed',context),true);
});
test('Course Map: 실제 GI 1→2→3→1, 선수별 현재 홀, 이전 마커 제거/데이터 없음, Raw Data 불변',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),nodes=new Map(),projected=[];
  class Element{
    constructor(){this.attrs={};this.children=[];this.events={};}
    addEventListener(type,fn){this.events[type]=fn;}
    append(node){this.children.push(node);}
    replaceChildren(){this.children=[];}
    setAttribute(key,value){this.attrs[key]=String(value);}
    toggleAttribute(key,enabled){if(enabled)this.attrs[key]='';else delete this.attrs[key];}
  }
  const el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const context={JGI_COURSE_LESSON_MAP:{},round:{currentHole:1,course:'Jagorawi Golf & Country Club'},
    document:{getElementById:el,createElementNS:()=>new Element()},Date};context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../jagorawi-old-course-data.js'),'utf8'),context);
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  for(const name of ['isOraSouthLeft','activeCourseData','unpackCourseShape','courseShapes','courseViewProjector','svgPath']){
    const source=html.match(new RegExp('^function '+name+'\\([^]*?^}','m'))?.[0];assert.ok(source,name);vm.runInContext(source,context);
  }
  const project=context.courseViewProjector;
  context.courseViewProjector=(h,r,points)=>{projected.push({h,r,points});return project(h,r,points);};
  vm.runInContext(fs.readFileSync(require.resolve('../course-lesson-map.js'),'utf8'),context);
  const engine=services();let group=registeredGroup(2,engine);const [a,b]=group.players;
  group=physical(group,a.playerId,mapPoint(),engine);group=physical(group,b.playerId,gpsPoint(),engine);
  const controller=context.JGICourseLessonMapController({querySelector:s=>el(s.slice(1))},()=>group,()=>assert.fail('Missing geometry must not accept a click'),{});
  const snapshot=structuredClone(group),history=structuredClone(group.players.map(p=>p.round.holes)),paths=[];
  for(const hole of [1,2,3,1]){
    group=lesson.chooseHole(group,a.playerId,hole);
    const before=structuredClone(group);controller.render();assert.deepEqual(group,before);
    const raw=context.JGI_OLD_COURSE_DATA.holes[String(hole)],svg=el('lessonCourseSvg');
    assert.equal(svg.attrs['data-hole'],String(hole));assert.equal(svg.attrs['data-hole-id'],String(raw.i));
    assert.equal(projected.at(-1).h,raw);assert.equal(projected.at(-1).r.currentHole,hole);
    const shapes=svg.children.filter(node=>node.attrs['data-course-shape']);
    const expected=context.courseShapes(raw,group.players[0].round).slice().sort((a,b)=>{
      const order={HOLE_BOUNDARY:0,WATER:1,WATER_PATH:2,FAIRWAY:3,BUNKER:4,TEE:5,GREEN:6};return (order[a.type]??9)-(order[b.type]??9);
    });
    assert.deepEqual(shapes.map(node=>node.attrs['data-course-shape']),Array.from(expected,s=>s.type));
    paths.push(shapes.map(node=>node.attrs.d).join('|'));
    assert.equal(svg.children.filter(node=>node.attrs['data-player-marker']).length,hole===1?2:0);
    if(hole!==1)assert.equal(projected.at(-1).points.length,0); // No hole-1 ball in the new viewport.
    assert.match(el('lessonMapStatus').textContent,new RegExp(hole+'번 홀'));
  }
  assert.notEqual(paths[0],paths[1]);assert.notEqual(paths[1],paths[2]);assert.equal(paths[0],paths[3]);
  group=lesson.chooseHole(group,a.playerId,3);group=lesson.selectPlayer(group,b.playerId);controller.render();
  assert.equal(el('lessonCourseSvg').attrs['data-hole'],'1');
  assert.equal(el('lessonCourseSvg').children.filter(node=>node.attrs['data-player-marker']).length,1);
  group=lesson.chooseHole(group,b.playerId,2);group=physical(group,b.playerId,mapPoint(),engine);controller.render();
  assert.equal(el('lessonCourseSvg').children.filter(node=>node.attrs['data-player-marker']).length,1);
  const raw=context.JGI_OLD_COURSE_DATA.holes['2'],before=structuredClone(group);
  delete context.JGI_OLD_COURSE_DATA.holes['2'];controller.render();
  assert.equal(el('lessonCourseSvg').children.length,0);assert.equal(el('lessonCourseSvg').attrs['data-hole-id'],'');
  assert.match(el('lessonMapStatus').textContent,/2번 홀 GI 지도 데이터가 없습니다/);
  assert.equal(el('lessonSatelliteMap').hidden,true);assert.equal(el('lessonSatellite').disabled,true);
  el('lessonCourseSvg').events.click({});assert.deepEqual(group,before);
  context.JGI_OLD_COURSE_DATA.holes['2']=raw;controller.render();assert.ok(el('lessonCourseSvg').children.length>0);
  assert.deepEqual(group.players.map(p=>p.round.holes[0]),snapshot.players.map(p=>p.round.holes[0]));
  assert.deepEqual(group.players[0].round.holes,history[0]);
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
    toggleAttribute(){}
    showModal(){this.open=true;}
    close(){this.open=false;closed.push(()=>this.emit('close'));}
  }
  const el=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  class Marker{setMap(m){this.map=m;}setPosition(){}setLabel(){}setZIndex(){}setIcon(){}}
  class Polygon{constructor(options){this.paths=options.paths;this.map=options.map;polygons.push(this);}setMap(m){this.map=m;}}
  class Bounds{constructor(){this.points=[];}extend(p){this.points.push(p);}}
  const map={listeners:[],fits:[],addListener(type,fn){this.listeners.push(fn);},fitBounds(bounds){this.fits.push(bounds.points);}};
  const context={window:{JGI_COURSE_LESSON_MAP:{},activeCourseData:()=>({holes:{'1':{t:[0,0],g:[1,1]},'2':{t:[0,0],g:[2,2]}}}),
      courseViewProjector:()=>({shapes:[{type:'GREEN',path:[{lat:0,lng:0},{lat:1,lng:0},{lat:1,lng:1}]}],project:p=>({x:p.lng,y:p.lat,inside:true})}),
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
  assert.equal(map.fits.length,0); // Hidden DOM must finish layout before fitBounds.
  for(const frame of frames.splice(0))frame();assert.equal(map.fits.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(map.fits[0].slice(0,2))),[{lat:0,lng:0},{lat:1,lng:1}]);
  controller.unavailable('TEST_AUTH_ERROR');assert.equal(el('lessonSatellite').disabled,true);assert.match(el('lessonMapStatus').textContent,/TEST_AUTH_ERROR/);
  controller.attach(map);assert.equal(el('lessonSatellite').disabled,false);assert.equal(map.listeners.length,1);
  assert.doesNotMatch(el('lessonMapStatus').textContent,/TEST_AUTH_ERROR/);el('lessonSatellite').emit('click');
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

test('Preview 지도 진단: 로딩 전 순서/크기, 실제 오류 코드만 수집, 민감정보 미보존, 100개 제한',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../course-lesson.js'),'utf8');
  const listeners={},forwarded=[],output={textContent:''},node={getBoundingClientRect:()=>({width:390,height:600}),parentElement:{getBoundingClientRect:()=>({width:390,height:620})}};
  const context={window:{location:{hostname:'preview.example'},addEventListener:(name,fn)=>listeners[name]=fn},
    document:{getElementById:()=>node},console:{error:(...args)=>forwarded.push(args)},Date};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function installMapDiagnostics(){'),source.indexOf('  let sharedMap=null')),context);
  const diag=context.window.JGI_COURSE_LESSON_DIAGNOSTICS;
  diag.record('Maps.load');diag.record('Maps.init');diag.record('onReady');diag.mount(output);
  assert.match(output.textContent,/1 · .*diagnostics.start[\s\S]*2 · .*Maps.load[\s\S]*3 · .*Maps.init[\s\S]*4 · .*onReady/);
  assert.match(output.textContent,/오류 코드: 확인 안 됨/);
  assert.match(output.textContent,/390 × 600px.*390 × 620px/);
  context.console.error('Google Maps JavaScript API error: RefererNotAllowedMapError https://example.invalid/?key=SECRET', {token:'SECRET'});
  listeners.error({message:'Google Maps JavaScript API error: InvalidKeyMapError https://example.invalid/?token=SECRET'});
  context.console.error('/api/whoop/today 503 SECRET','Google Maps loading=async warning');
  diag.record('gm_authFailure');diag.record('onError.AUTH_FAILURE');diag.state('JGI','AUTH_FAILURE',true);
  assert.match(output.textContent,/RefererNotAllowedMapError, InvalidKeyMapError/);
  assert.match(output.textContent,/JGI 복귀 사유: AUTH_FAILURE/);
  assert.match(output.textContent,/기존 Map 연결: 연결됨/);
  assert.doesNotMatch(output.textContent,/SECRET|https:|whoop|503|async warning/);
  assert.equal(forwarded.length,2); // Original console output preserved.
  const before=output.textContent;diag.record('SECRET');assert.equal(output.textContent,before);
  for(let i=0;i<110;i++)diag.record('Maps.reuse');
  assert.equal(output.textContent.split('\n').filter(line=>/^\d+ ·/.test(line)).length,100);
  assert.ok(source.indexOf('window.JGI_COURSE_LESSON_DIAGNOSTICS=installMapDiagnostics()')>source.indexOf('if(!developmentAllowed(window.location))return;'));
});

test('Penalty: A OB1 → B HAZARD2 → A LOST BALL1, 선수별 Score/위치/기록 독립',()=>{
  const engine=services();let group=registeredGroup(4,engine);
  for(const p of group.players)group=physical(group,p.playerId,mapPoint(),engine);
  const original=structuredClone(group),[a,b]=group.players;
  group=lesson.recordPenalty(group,a.playerId,1,'clpen_a1','OB',1,engine);
  assert.deepEqual(group.players.slice(1),original.players.slice(1));
  group=lesson.selectPlayer(group,b.playerId);const aBefore=structuredClone(group.players[0]);
  group=lesson.recordPenalty(group,b.playerId,1,'clpen_b1','HAZARD',2,engine);
  assert.deepEqual(group.players[0],aBefore);
  group=lesson.selectPlayer(group,a.playerId);
  group=lesson.recordPenalty(group,a.playerId,1,'clpen_a2','LOST_BALL',1,engine);
  for(const [i,total] of [[0,2],[1,2],[2,0],[3,0]]){
    const p=group.players[i],before=original.players[i],h=p.round.holes[0];assert.equal(h.penalties,total);
    if(total)assert.equal(h.score,3);
    for(const key of ['shots','putts','puttsDetail'])assert.deepEqual(h[key],before.round.holes[0][key]);
    for(const key of ['shotDraft','ballPosition','profile','playerId','roundId'])assert.deepEqual(p[key],before[key]);
    assert.deepEqual(p.round.pending,before.round.pending);assert.deepEqual(p.round.holes.slice(1),before.round.holes.slice(1));
  }
  assert.deepEqual(group.players[0].round.holes[0].penaltyEvents.map(e=>[e.type,e.strokes,e.hole,e.at]),[['OB',1,1,1234],['LOST_BALL',1,1,1234]]);
  const store=memory();lesson.saveGroup(store,group);const restored=lesson.restoreGroup(store);assert.deepEqual(restored,group);
  assert.equal(store.getItem('agi_player_v1_round'),'unchanged-player');
  assert.throws(()=>lesson.recordPenalty(restored,a.playerId,1,'clpen_a1','OB',1,engine),/이미 저장/);
  const beforeCancel=structuredClone(group);group=lesson.cancelPenalty(group,a.playerId,1,'clpen_a1',engine);
  assert.equal(group.players[0].round.holes[0].penalties,1);assert.equal(group.players[0].round.holes[0].score,2);
  assert.deepEqual(group.players.slice(1),beforeCancel.players.slice(1));
  assert.deepEqual(group.players[0].round.holes[0].penaltyEvents,[beforeCancel.players[0].round.holes[0].penaltyEvents[1]]);
  assert.throws(()=>lesson.cancelPenalty(group,a.playerId,1,'clpen_a1',engine),/찾을 수/);
  assert.deepEqual(original.players[0].round.holes[0].penaltyEvents,[]);
});

test('Penalty: 1~9 규칙과 선수/홀/ID/중복 검증은 원본을 변경하지 않음',()=>{
  const engine=services(),group=registeredGroup(2,engine),[a,b]=group.players,before=JSON.stringify(group);
  for(const strokes of [0,10,-1,1.5,'1',null,NaN])assert.throws(()=>lesson.recordPenalty(group,a.playerId,1,'clpen_bad','OB',strokes,engine),/1~9/);
  assert.throws(()=>lesson.recordPenalty(group,a.playerId,1,'clpen_bad','OTHER',1,engine),/선택/);
  assert.throws(()=>lesson.recordPenalty(group,a.playerId,2,'clpen_bad','OB',1,engine),/선수\/홀/);
  assert.throws(()=>lesson.recordPenalty(group,b.playerId,1,'clpen_bad','OB',1,engine),/선택 선수/);
  assert.throws(()=>lesson.recordPenalty(group,a.playerId,1,'bad','OB',1,engine),/ID/);
  const nine=lesson.recordPenalty(group,a.playerId,1,'clpen_nine','OB',9,engine);assert.equal(nine.players[0].round.holes[0].score,9);
  assert.throws(()=>lesson.cancelPenalty(nine,b.playerId,1,'clpen_nine',engine),/선택 선수/);
  assert.throws(()=>lesson.cancelPenalty(nine,a.playerId,2,'clpen_nine',engine),/선수\/홀/);
  assert.throws(()=>lesson.cancelPenalty(nine,a.playerId,1,'missing',engine),/찾을 수/);
  assert.throws(()=>lesson.recordPenalty(lesson.selectPlayer(nine,b.playerId),b.playerId,1,'clpen_nine','OB',1,engine),/이미 저장/);
  assert.equal(JSON.stringify(group),before);
});

test('Penalty: 벌타 먼저 입력한 뒤 SHOT SAVE/HOLED 및 취소도 Score 일관성 유지',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.selectedPlayerId;
  group=lesson.recordPenalty(group,pid,1,'clpen_first','OB',2,engine);assert.equal(group.players[0].round.holes[0].score,2);
  group=physical(group,pid,mapPoint(),engine);assert.equal(group.players[0].round.holes[0].score,3);
  group=lesson.holed(group,pid,group.players[0].round.holes[0].shots[0].id,engine);
  const before=structuredClone(group.players[0]);group=lesson.cancelPenalty(group,pid,1,'clpen_first',engine);
  const h=group.players[0].round.holes[0];assert.equal(h.penalties,0);assert.equal(h.score,1);assert.equal(h.completed,true);
  for(const key of ['shots','puttsDetail','completedAt','lessonStatus'])assert.deepEqual(h[key],before.round.holes[0][key]);
  const undone=lesson.undoLastShot(group,pid,h.shots[0].id,engine);assert.equal(undone.players[0].round.holes[0].shots.length,0);
});

test('Penalty: Putting Draft/마커 좌표/HOLED 유지, 후속 홀 기록 뒤 벌타만 안전 취소',()=>{
  const fixture=puttingFixture(2),engine=fixture.engine;let group=fixture.group,pid=group.selectedPlayerId;
  group=lesson.setPuttDistance(group,pid,1,'8',engine);const before=structuredClone(group.players[0]);
  group=lesson.recordPenalty(group,pid,1,'clpen_putt','HAZARD',2,engine);
  assert.deepEqual(group.players[0].round.holes[0].puttingReady,before.round.holes[0].puttingReady);
  assert.deepEqual(group.players[0].shotDraft,before.shotDraft);assert.deepEqual(group.players[0].ballPosition,before.ballPosition);
  group=putt(group,pid,8,'SHORT',engine);assert.equal(group.players[0].round.holes[0].score,6);
  group=putt(group,pid,1,'HOLED',engine);assert.equal(group.players[0].round.holes[0].score,7);
  const other=group.players[1].playerId;group=putt(group,other,1,'HOLED',engine);
  group=lesson.saveHoleCompletion(memory(),group,1,engine).group;assert.ok(group.players.every(p=>p.round.currentHole===2));
  group=physical(group,pid,mapPoint(),engine);group=lesson.chooseHole(group,pid,1);group=lesson.selectPlayer(group,pid);
  const saved=structuredClone(group);group=lesson.cancelPenalty(group,pid,1,'clpen_putt',engine);
  const h=group.players[0].round.holes[0];assert.equal(h.score,5);assert.equal(h.putts,2);assert.equal(h.completed,true);
  assert.deepEqual(h.shots,saved.players[0].round.holes[0].shots);assert.deepEqual(h.puttsDetail,saved.players[0].round.holes[0].puttsDetail);
  assert.deepEqual(group.players[0].round.holes.slice(1),saved.players[0].round.holes.slice(1));assert.deepEqual(group.players[1],saved.players[1]);
});

test('Penalty: 기존 네 필드 이벤트와 Group version1 호환, 불일치 시 임의 합계 덮어쓰기 금지',()=>{
  const engine=services();let group=registeredGroup(1,engine);const pid=group.selectedPlayerId;
  const legacy={type:'OB',strokes:1,hole:1,at:1000};group.players[0].round.holes[0].penaltyEvents=[legacy];group.players[0].round.holes[0].penalties=1;
  const store=memory();lesson.saveGroup(store,group);group=lesson.restoreGroup(store);
  group=lesson.recordPenalty(group,pid,1,'clpen_new','LOST_BALL',1,engine);assert.equal(group.version,1);
  group=lesson.cancelPenalty(group,pid,1,'clpen_new',engine);assert.deepEqual(group.players[0].round.holes[0].penaltyEvents,[legacy]);
  const bad=structuredClone(group);bad.players[0].round.holes[0].penalties=4;
  const raw=JSON.stringify(bad);assert.throws(()=>lesson.recordPenalty(bad,pid,1,'clpen_bad','OB',1,engine),/일치하지/);assert.equal(JSON.stringify(bad),raw);
});
