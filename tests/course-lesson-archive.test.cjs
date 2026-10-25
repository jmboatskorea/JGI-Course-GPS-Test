'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../course-lesson.js');
function fixture(){
  let sequence=0;
  const services={uuid:()=>String(++sequence),now:()=>1234,hydrate:r=>r,
    benchmark:r=>({handicap:r.playerHandicap,label:'TEST',type:'MODELED',fallback:false})};
  const values=new Map([['agi_player_v1_round','personal'],['jgi_completed_rounds_v1','history']]),ops=[];
  const storage={getItem:k=>{ops.push(['get',k]);return values.get(k)??null;},setItem:(k,v)=>{ops.push(['set',k]);values.set(k,v);},removeItem:k=>{ops.push(['remove',k]);values.delete(k);}};
  let group=E.createGroup(2,services);
  for(const [i,p] of group.players.entries())group=E.registerPlayer(group,p.playerId,{name:'TEST '+i,contact:'',sex:'MALE',handicap:String(i+1),tee:i?'Red':'Blue'},services);
  group=E.recordPenalty(group,group.selectedPlayerId,1,'clpen_test','OB',1,services);
  E.saveGroup(storage,group);return {services,storage,group,values,ops};
}
test('finish verifies a separate full snapshot before removing only the active Lesson',()=>{
  const {services,storage,group,values,ops}=fixture(),before=structuredClone(group);ops.length=0;
  const entry=E.finishGroup(storage,group,services);
  assert.deepEqual(entry.group,before);assert.deepEqual(group,before);
  assert.equal(E.restoreGroup(storage),null);assert.deepEqual(E.restoreArchives(storage),[entry]);
  const write=ops.findIndex(([op,k])=>op==='set'&&k===E.ARCHIVE_STORAGE),read=ops.findIndex(([op,k],i)=>i>write&&op==='get'&&k===E.ARCHIVE_STORAGE),remove=ops.findIndex(([op,k])=>op==='remove'&&k===E.STORAGE);
  assert.ok(write>=0&&read>write&&remove>read);
  assert.equal(values.get('agi_player_v1_round'),'personal');assert.equal(values.get('jgi_completed_rounds_v1'),'history');
  assert.ok(entry.group.players.every(p=>p.round.holes.every(h=>h.completed===false)));
});
test('repeat finish is idempotent; a stale finish cannot remove a new Group',()=>{
  const {services,storage,group,ops}=fixture();const first=E.finishGroup(storage,group,services),payload=storage.getItem(E.ARCHIVE_STORAGE);ops.length=0;
  assert.deepEqual(E.finishGroup(storage,group,{now:()=>9999}),first);assert.equal(storage.getItem(E.ARCHIVE_STORAGE),payload);
  assert.ok(!ops.some(([op])=>op==='set'||op==='remove'));
  const next=E.createGroup(1,services);E.saveGroup(storage,next);
  assert.throws(()=>E.finishGroup(storage,group,services),/변경/);assert.deepEqual(E.restoreGroup(storage),next);assert.equal(storage.getItem(E.ARCHIVE_STORAGE),payload);
});
for(const failure of ['write','readback','remove','no-remove'])test(failure+' failure keeps the current Group and supports one safe retry',()=>{
  const {services,storage,group}=fixture(),before=storage.getItem(E.STORAGE),original={...storage};let wrote=false;
  storage.setItem=(k,v)=>{if(k===E.ARCHIVE_STORAGE){if(failure==='write')throw Error('quota');wrote=true;}original.setItem(k,v);};
  storage.getItem=k=>k===E.ARCHIVE_STORAGE&&wrote&&failure==='readback'?'unverified':original.getItem(k);
  storage.removeItem=k=>{if(k===E.STORAGE){if(failure==='remove')throw Error('denied');if(failure==='no-remove')return;}original.removeItem(k);};
  assert.throws(()=>E.finishGroup(storage,group,services));assert.equal(storage.getItem(E.STORAGE),before);
  Object.assign(storage,original);E.finishGroup(storage,group,services);
  assert.equal(E.restoreArchives(storage).length,1);assert.equal(E.restoreGroup(storage),null);
});
test('invalid archive and mismatching active data cannot overwrite any saved records',()=>{
  const {services,storage,group}=fixture(),active=storage.getItem(E.STORAGE);
  storage.setItem(E.ARCHIVE_STORAGE,'invalid');assert.throws(()=>E.finishGroup(storage,group,services));
  assert.equal(storage.getItem(E.ARCHIVE_STORAGE),'invalid');assert.equal(storage.getItem(E.STORAGE),active);
  storage.removeItem(E.ARCHIVE_STORAGE);const changed=structuredClone(group);changed.updatedAt=9999;
  assert.throws(()=>E.finishGroup(storage,changed,services),/변경/);assert.equal(storage.getItem(E.ARCHIVE_STORAGE),null);assert.equal(storage.getItem(E.STORAGE),active);
});
test('invalid completion time cannot produce an unreadable archive or close the active Group',()=>{
  const {storage,group}=fixture(),active=storage.getItem(E.STORAGE);
  for(const now of [NaN,Infinity,0])assert.throws(()=>E.finishGroup(storage,group,{now:()=>now}),/종료 시각/);
  assert.equal(storage.getItem(E.STORAGE),active);assert.equal(storage.getItem(E.ARCHIVE_STORAGE),null);
});
test('new rounds retain old independent snapshots and restored results are read-only copies',()=>{
  const {services,storage,group}=fixture();const first=E.finishGroup(storage,group,services);
  let next=E.createGroup(1,services);next=E.registerPlayer(next,next.selectedPlayerId,{name:'TEST NEW',contact:'',sex:'FEMALE',handicap:'6',tee:'White'},services);
  E.saveGroup(storage,next);E.finishGroup(storage,next,services);
  const entries=E.restoreArchives(storage);assert.equal(entries.length,2);assert.deepEqual(entries[0],first);
  entries[0].group.players[0].profile.name='MUTATED';assert.deepEqual(E.restoreArchives(storage)[0],first);
});
test('18-hole completion is preserved and unfinished holes are never completed by finish',()=>{
  const {services,storage,group}=fixture();
  // Existing legacy-format complete holes remain valid; the archive does not infer completion.
  group.players[0].round.holes.forEach(h=>{h.completed=true;});E.saveGroup(storage,group);
  const entry=E.finishGroup(storage,group,services);
  assert.equal(entry.group.players[0].round.holes.filter(h=>h.completed).length,18);
  assert.equal(entry.group.players[1].round.holes.filter(h=>h.completed).length,0);
  assert.deepEqual(entry.group,group);
});
