'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const lesson=require('../course-lesson.js');
function services(){
  let sequence=0;
  return {uuid:()=>String(++sequence),now:()=>1234,courseVersion:'TEST_COURSE',dataVersion:'TEST_SG',
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
