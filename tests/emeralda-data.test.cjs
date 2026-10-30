'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'..'),json=value=>JSON.parse(JSON.stringify(value));
const expected={
  River:{id:22976,holes:[370814,370815,370816,370817,370818,370819,370820,370821,370822]},
  Lake:{id:22977,holes:[370823,370824,370825,370826,370827,370828,370829,370830,370831]},
  Plantation:{id:22978,holes:[370832,370833,370834,370835,370836,370837,370838,370839,370840]}
};
const names=Object.keys(expected),tees=['Gold','Black','Blue','White','Red'];
function context(withData=true){
  const value={};value.window=value;vm.createContext(value);
  if(withData)vm.runInContext(fs.readFileSync(path.join(repo,'emeralda-course-data.js'),'utf8'),value,{filename:'emeralda-course-data.js'});
  vm.runInContext(fs.readFileSync(path.join(repo,'emeralda-courses.js'),'utf8'),value,{filename:'emeralda-courses.js'});
  return value;
}
function round(api,front,back){return {course:api.CLUB,nine:api.pair(front,back)};}
const numbers=n=>Array.from({length:n},(_,i)=>i+1);

test('27 original holes retain their verified named-nine IDs, mapping anchors and geometry',()=>{
  const s=context(),raw=s.JGI_EMERALDA_NINES,ids=new Set();
  assert.equal(raw.length,3);assert.deepEqual(json(raw.map(e=>e.data.nine)).sort(),names.slice().sort());
  for(const entry of raw){
    const {data,scorecard,mapping}=entry,want=expected[data.nine];
    assert.equal(data.course,'Emeralda Golf Club');assert.equal(data.courseId,want.id);
    assert.deepEqual(Object.keys(data.holes).map(Number).sort((a,b)=>a-b),numbers(9));
    assert.equal(mapping.length,9);assert.equal(new Set(mapping.map(m=>m.holeNumber)).size,9);
    for(let n=1;n<=9;n++){
      const h=data.holes[n],m=mapping.find(m=>m.holeNumber===n),card=scorecard.holes[n];
      assert.equal(h.i,want.holes[n-1]);assert.equal(h.holeId,h.i);assert.ok(!ids.has(h.i));ids.add(h.i);
      assert.deepEqual([h.sourceCourseId,h.sourceHoleNumber,h.sourceNine],[want.id,n,data.nine]);
      assert.deepEqual([m.courseId,m.holeNumber,m.holeId],[want.id,n,h.i]);
      assert.equal(m.sourceEvidence.holeName,data.nine+' #'+n);
      assert.deepEqual(json(h.t),json(m.tee));assert.deepEqual(json(h.g),json(m.green));
      for(const p of [h.t,h.g])assert.ok(p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180);
      assert.notDeepEqual(json(h.t),json(h.g));
      for(const type of ['T','F','G'])assert.ok(h.s.some(shape=>shape[0]===type),data.nine+' '+n+' missing '+type);
      assert.equal(card.indexMen,null);assert.equal(card.indexLadies,null);
    }
  }
  assert.equal(ids.size,27);
});

test('six ordered 18-hole combinations map front 1–9 and back 10–18 without changing source geometry',()=>{
  const s=context(),api=s.JGIEmeraldaCourses,raw=s.JGI_EMERALDA_NINES,before=JSON.stringify(raw),metadata=JSON.stringify(s.JGI_EMERALDA_SOURCE);
  const catalog=json(api.catalog()),pairs=names.flatMap(a=>names.filter(b=>a!==b).map(b=>a+' / '+b));
  assert.equal(api.CLUB,'Emeralda Golf Club');assert.deepEqual(json(api.nines),names);assert.deepEqual(json(api.ids),names.map(n=>expected[n].id));
  assert.equal(catalog.length,6);assert.deepEqual(catalog.map(x=>x.nine).sort(),pairs.slice().sort());assert.equal(new Set(catalog.map(x=>x.version)).size,6);
  for(const descriptor of catalog){
    const [front,back]=descriptor.nine.split(' / '),r={course:descriptor.course,nine:descriptor.nine,courseVersion:descriptor.version},data=api.data(r),card=api.scorecard(r);
    assert.equal(api.pair(front,back),descriptor.nine);assert.equal(data.version,descriptor.version);
    assert.equal(data.courseId,null);assert.equal(card.courseId,null);
    assert.deepEqual(json(data.courseIds),[expected[front].id,expected[back].id]);
    assert.equal(card.courseName,descriptor.nine);assert.deepEqual(Object.keys(data.holes).map(Number).sort((a,b)=>a-b),numbers(18));
    assert.deepEqual(Object.keys(card.holes).map(Number).sort((a,b)=>a-b),numbers(18));
    for(let number=1;number<=18;number++){
      const sourceNine=number<=9?front:back,local=(number-1)%9+1,entry=raw.find(e=>e.data.nine===sourceNine),original=entry.data.holes[local],h=data.holes[number],c=card.holes[number],sourceCard=entry.scorecard.holes[local];
      assert.deepEqual([h.i,h.holeId,h.sourceCourseId,h.sourceHoleNumber,h.sourceNine],[original.i,original.holeId,entry.data.courseId,local,sourceNine]);
      for(const key of ['t','g','s'])assert.deepEqual(json(h[key]),json(original[key]),descriptor.nine+' hole '+number+' '+key);
      if(original.w)for(let i=0;i<original.w.length;i++)assert.deepEqual(json(data.waters[h.w[i]]),json(entry.data.waters[original.w[i]]));
      for(const key of ['par',...tees,'sourceHandicap','status','source'])assert.deepEqual(json(c[key]),json(sourceCard[key]),descriptor.nine+' hole '+number+' '+key);
      assert.deepEqual([c.sourceCourseId,c.sourceHoleNumber,c.sourceNine],[entry.data.courseId,local,sourceNine]);
      assert.equal(c.indexMen,null);assert.equal(c.indexLadies,null);assert.deepEqual(json(api.sourceHole(r,number)),json(h));
    }
    const reverse=api.data(round(api,back,front));assert.equal(reverse.holes[1].i,data.holes[10].i);assert.equal(reverse.holes[10].i,data.holes[1].i);
    assert.equal(api.sourceHole(r,0),null);assert.equal(api.sourceHole(r,19),null);
  }
  assert.equal(JSON.stringify(raw),before);assert.equal(JSON.stringify(s.JGI_EMERALDA_SOURCE),metadata);
});

test('unresolved values remain null and Lake historical values/HCP remain source references',()=>{
  const s=context(),api=s.JGIEmeraldaCourses;let unresolved=0;
  for(const entry of s.JGI_EMERALDA_NINES){
    const lake=entry.data.nine==='Lake';
    for(const h of Object.values(entry.scorecard.holes)){
      for(const key of ['par',...tees,'indexMen','indexLadies'])if(h[key]===null)unresolved++;
      assert.equal(h.indexMen,null);assert.equal(h.indexLadies,null);
      if(lake){assert.match(h.status,/historical/);assert.ok([3,4,5].includes(h.par));assert.ok(tees.every(t=>Number.isFinite(h[t])&&h[t]>0));assert.ok(Number.isInteger(h.sourceHandicap));}
      else{for(const key of ['par',...tees,'sourceHandicap'])assert.equal(h[key],null);assert.match(h.status,/unresolved/);}
    }
  }
  assert.equal(unresolved,162);assert.equal(s.JGI_EMERALDA_SOURCE.unresolvedCounts.normalizedScorecardNullFields,162);
  for(const descriptor of api.catalog()){
    const card=api.scorecard(descriptor),r={...descriptor,holes:Object.values(card.holes)};
    assert.match(card.handicapStatus,/UNVERIFIED/);assert.match(card.status,/HISTORICAL/);
    assert.equal(api.scorecardReady(r),false);for(const tee of tees)assert.equal(card.tees[tee].total,null);
  }
});

test('same-nine, bare historical Lake, unknown pairs and mismatched versions never fall back',()=>{
  const s=context(),api=s.JGIEmeraldaCourses;
  for(const n of names)assert.equal(api.pair(n,n),null);
  assert.equal(api.pair('River','Unknown'),null);assert.equal(api.pair('Unknown','Lake'),null);
  for(const nine of ['Lake','River / River','River / Unknown','River / Lake / Plantation','']){
    const r={course:api.CLUB,nine};assert.equal(api.isRound(r),true);assert.equal(api.data(r),null);assert.equal(api.scorecard(r),null);assert.equal(api.sourceHole(r,1),null);
  }
  for(const r of [{course:'Jagorawi Golf & Country Club',nine:'Old Course'},{course:'Ora Country Club',nine:'South Left'},{course:'Gunung Geulis',nine:'East Course'}]){
    assert.equal(api.isRound(r),false);assert.equal(api.data(r),null);assert.equal(api.scorecard(r),null);assert.equal(api.sgMissing(r,{par:null},{startLie:'TEE'},0),null);
  }
  const r={...round(api,'River','Lake'),courseVersion:'UNRECOGNIZED_VERSION'};
  assert.equal(api.data(r),null);assert.equal(api.scorecard(r),null);assert.match(api.description(r),/원본 기록 보존/);
  const absent=context(false).JGIEmeraldaCourses;assert.equal(absent.catalog().length,0);assert.equal(absent.data(round(absent,'River','Lake')),null);
});

test('SG missing prerequisites are reported without replacing unresolved data with zero',()=>{
  const s=context(),api=s.JGIEmeraldaCourses,r=round(api,'River','Lake'),lake=round(api,'Lake','River');
  const unresolved=api.scorecard(r).holes[1],known=api.scorecard(lake).holes[1];
  assert.match(api.sgMissing(r,{...json(unresolved),teeDistanceM:null},{startLie:'TEE'},0),/Par/);
  assert.match(api.sgMissing(lake,{...json(known),teeDistanceM:null},{startLie:'TEE'},0),/거리/);
  assert.equal(api.sgMissing(lake,{...json(known),teeDistanceM:known.Blue},{startLie:'TEE'},0),null);
  assert.equal(api.sgMissing(lake,{...json(known),teeDistanceM:null},{startLie:'FAIRWAY'},1),null);
  assert.match(api.sgMissing({course:api.CLUB,nine:'Lake'},known,{startLie:'TEE'},0),/조합/);
  assert.match(api.description(r),/Lake/);assert.match(api.description(r),/Handicap/);
});
