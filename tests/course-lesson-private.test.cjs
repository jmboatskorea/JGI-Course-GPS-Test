'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../course-lesson-private.js');
globalThis.crypto||=require('node:crypto').webcrypto;
globalThis.window={location:{hostname:'localhost'}};
function fixture(){
  return {format:P.FORMAT,courses:[22984,22983].map((courseId,c)=>{
    const holes={},cards={},mapping=[];
    for(let n=1;n<=18;n++){
      const holeId=1000+c*100+n,t=[n/100,0],g=[n/100+.001,.001];
      const poly=[t,[t[0]+.001,0],g,t];
      holes[n]={i:holeId,holeId,t,g,s:[['F',0,poly],['T',0,poly],['G',0,poly]]};
      cards[n]={par:4,Blue:300,White:280,Red:250,Black:320,indexMen:n,indexLadies:n};
      mapping.push({courseId,holeNumber:n,holeId,tee:t,green:g,mappingStatus:'documentary_cross_validated',fieldValidated:false,unresolvedFields:[]});
    }
    cards[1].Blue=null;cards[1].indexMen=null;cards[1].indexLadies=null;mapping[0].unresolvedFields=['blue','handicap'];
    const nine=c?'West Course':'East Course';
    return {data:{courseId,course:'Gunung Geulis',nine,holes},scorecard:{courseId,course:'Gunung Geulis',courseName:nine,holes:cards,tees:{}},mapping};
  })};
}
const text=()=>JSON.stringify(fixture());
function storage(){
  const values=new Map([['jgi_course_lesson_group_v1','original-group'],['agi_player_v1_round','original-personal']]);
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
}
test('36홀 ID/좌표는 명시된 검증 매핑으로만 연결하고 입력 객체/미확정 값은 보존',()=>{
  const value=fixture();value.courses[0].mapping.reverse();const before=JSON.stringify(value);
  const version='a'.repeat(64),out=P.validate(value,version);
  assert.equal(out[0].data.holes[1].i,1001);assert.equal(out[1].data.holes[1].i,1101);
  assert.equal(out[0].scorecard.holes[1].Blue,null);assert.equal(out[0].scorecard.holes[1].indexMen,null);
  assert.equal(JSON.stringify(value),before);
  assert.equal(value.courses[0].data.version,undefined);assert.equal(out[0].data.version,'PRIVATE_GI_'+version);
});
test('동서 ID 혼합·누락·좌표 불일치·충돌값 채우기·인증정보를 거부',()=>{
  const cases=[
    x=>x.courses[1].data.courseId=22984,
    x=>x.courses[0].mapping.pop(),
    x=>x.courses[0].mapping[0].holeId=1101,
    x=>x.courses[0].data.holes[1].g=[1,1],
    x=>x.courses[0].scorecard.holes[1].Blue=300,
    x=>x.courses[0].scorecard.holes[1].indexLadies=1,
    x=>x.courses[0].data.holes[1].t=[100,1],
    x=>x.apiKey='SYNTHETIC_DO_NOT_CACHE'
  ];
  for(const change of cases){const x=fixture();change(x);assert.throws(()=>P.validate(x,'a'.repeat(64)));}
});
test('가져오기는 기본 세션 전용이며 허용된 Production/Preview/local에서만 사용',async()=>{
  const s=storage();await assert.rejects(P.importText(text(),{storage:s}),/사용 권한/);
  await P.importText(text(),{storage:s,rights:true});assert.equal(s.getItem(P.KEY),null);
  assert.equal(P.catalog().length,2);
  for(const host of ['jgi-course-gps-test.vercel.app','jgi-course-gps-test-git-ui-course-less-faefbe-jmboatskorea-9766.vercel.app','localhost'])assert.equal(P.allowed({hostname:host}),true);
  for(const host of ['example.com','jgi-course-gps-test.vercel.app.example.com'])assert.equal(P.allowed({hostname:host}),false);
  window.location.hostname='jgi-course-gps-test.vercel.app';
  await P.importText(text(),{storage:s,rights:true,cache:true});
  const cached=s.getItem(P.KEY);P.forget(s);s.setItem(P.KEY,cached);await P.restore(s,window.location);
  assert.equal(P.catalog().length,2);
  window.location.hostname='example.com';
  await assert.rejects(P.importText(text(),{storage:s,rights:true}),/허용된 JGI/);window.location.hostname='localhost';
  assert.equal(s.getItem('jgi_course_lesson_group_v1'),'original-group');assert.equal(s.getItem('agi_player_v1_round'),'original-personal');
});
test('명시적 기기 저장/압축 복원·변조 검출·다른 버전 차단과 원본 기록 보존',async()=>{
  const s=storage();await P.importText(text(),{storage:s,rights:true,cache:true});
  const saved=s.getItem(P.KEY),version=P.catalog()[0].version;
  assert.equal(JSON.parse(saved).encoding,'gzip-base64');
  P.forget(s);assert.equal(P.catalog().length,0);s.setItem(P.KEY,saved);await P.restore(s,{hostname:'localhost'});
  assert.equal(P.catalog()[0].version,version);
  await assert.rejects(P.importText(text()+' ',{storage:s,rights:true,cache:true,requiredVersions:()=>[version]}),/다른 버전/);
  assert.equal(s.getItem(P.KEY),saved);
  const changed=JSON.parse(saved);changed.fingerprint='0'.repeat(64);s.setItem(P.KEY,JSON.stringify(changed));
  await assert.rejects(P.restore(s,{hostname:'localhost'}),/변경/);assert.equal(P.catalog()[0].version,version);
  const quota={getItem:s.getItem,setItem:()=>{throw Error('quota');}};
  await assert.rejects(P.importText(text(),{storage:quota,rights:true,cache:true}),/저장 공간/);
  assert.equal(P.catalog()[0].version,version);assert.equal(s.getItem('jgi_course_lesson_group_v1'),'original-group');
  await P.importText(text(),{storage:s,rights:true,cache:false});assert.equal(s.getItem(P.KEY),null);
});
test('Par/선택 Tee 공식 거리/기기 파일이 없으면 해당 SG만 미계산, 다른 라운드는 그대로',()=>{
  const r={course:'Gunung Geulis',nine:'East Course'},h={par:4,teeDistanceM:null};
  assert.match(P.sgMissing(r,h,{startLie:'TEE'},0),/공식 거리/);
  assert.equal(P.sgMissing(r,{...h,teeDistanceM:300},{startLie:'TEE'},0),null);
  assert.equal(P.sgMissing(r,h,{startLie:'FAIRWAY'},1),null);
  assert.match(P.sgMissing(r,{...h,par:null},{startLie:'TEE'},0),/Par/);
  assert.equal(P.sgMissing({course:'Jagorawi Golf & Country Club'},h,{startLie:'TEE'},0),null);
  assert.equal(P.data({...r,courseVersion:'PRIVATE_GI_'+'0'.repeat(64)}),null);
  assert.match(P.sgMissing({...r,courseVersion:'PRIVATE_GI_'+'0'.repeat(64)},h,{startLie:'TEE'},0),/파일/);
});
test('공식 Par/거리/Handicap이 null이어도 Raw Shot/Green/Putt/Penalty와 Score를 기록',()=>{
  const E=require('../course-lesson.js');let seq=0;
  const service={uuid:()=>String(++seq),now:()=>1000+seq,clubs:['DR'],dataVersion:'SYNTHETIC',
    benchmark:r=>({handicap:r.playerHandicap,label:'synthetic',fallback:false}),hydrate:r=>r,
    shotContext:()=>({}),distance:()=>10,
    greenGeometry:(_r,hole)=>({hole,polygons:[[{lat:0,lng:0},{lat:0,lng:2},{lat:2,lng:2},{lat:2,lng:0}]]})};
  let g=E.createGroup(1,service),pid=g.players[0].playerId;
  g=E.registerPlayer(g,pid,{name:'TEST Null Scorecard',contact:'',sex:'FEMALE',handicap:'5',tee:'Blue'},service);
  const position={lat:1,lng:1,accuracy:null,time:1001,source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'};
  g=E.recordShot(E.confirmPosition(E.stagePosition(g,pid,position),pid,service),pid,service);
  const sid=g.players[0].round.holes[0].shots[0].id;
  g=E.onGreen(g,pid,sid,position,null,service);
  g=E.recordPenalty(g,pid,1,'clpen_synthetic_null','OB',1,service);
  g=E.setPuttDistance(g,pid,1,'8',service);g=E.recordPutt(g,pid,1,1,g.players[0].round.holes[0].puttingReady.inputId,'SHORT',service);
  g=E.setPuttDistance(g,pid,1,'1',service);g=E.recordPutt(g,pid,1,2,g.players[0].round.holes[0].puttingReady.inputId,'HOLED',service);
  const h=g.players[0].round.holes[0];
  assert.deepEqual([h.par,h.teeDistanceM,h.strokeIndexMen,h.strokeIndexLadies],[null,null,null,null]);
  assert.deepEqual([h.shots.length,h.putts,h.penalties,h.score,h.completed],[1,2,1,4,true]);
});
test('Gunung Geulis는 파일·체크박스·캐시 없이 기본 등록되고 기존 버전/미확정 값을 유지',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../gunung-geulis-course-data.js'),'utf8'),context);
  window.JGI_GUNUNG_GEULIS_COURSES=context.window.JGI_GUNUNG_GEULIS_COURSES;
  try{
    const s=storage();P.forget(s);assert.equal(s.getItem(P.KEY),null);
    assert.deepEqual(Array.from(P.catalog(),c=>c.nine),['East Course','West Course']);
    const ids=new Set();let conflicts=0;
    for(const e of window.JGI_GUNUNG_GEULIS_COURSES){
      assert.equal(Object.keys(e.data.holes).length,18);
      assert.equal(P.data({course:'Gunung Geulis',nine:e.data.nine}),e.data);
      assert.equal(P.data({course:'Gunung Geulis',nine:e.data.nine,courseVersion:e.data.version}),e.data);
      for(const m of e.mapping){assert.ok(!ids.has(m.holeId));ids.add(m.holeId);conflicts+=m.unresolvedFields.length;}
    }
    assert.equal(ids.size,36);assert.equal(conflicts,35);assert.ok(P.catalog().every(c=>c.privateLocal===false));
    assert.equal(s.getItem('jgi_course_lesson_group_v1'),'original-group');
  }finally{delete window.JGI_GUNUNG_GEULIS_COURSES;}
});
