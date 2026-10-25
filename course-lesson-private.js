/* Device-imported Course Lesson data. This file contains no provider GPS data. */
(function(){
  'use strict';
  const KEY='jgi_course_lesson_private_courses_v1',FORMAT='JGI_PRIVATE_COURSES_V1';
  const CLUB='Gunung Geulis',names=new Map([[22984,'East Course'],[22983,'West Course']]);
  const fail=message=>{throw Error(message);};
  const check=(ok,message)=>{if(!ok)fail(message);};
  const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const known=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const allowed=location=>['localhost','127.0.0.1','[::1]','jgi-course-gps-test-git-ui-course-less-faefbe-jmboatskorea-9766.vercel.app'].includes(location?.hostname);
  const isRound=r=>r?.course===CLUB;
  let loaded=[],fingerprint=null;
  function validate(value,version){
    const secrets=v=>{if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){
      check(!/api.?key|token|authorization|password|secret|cookie/i.test(k),'인증정보가 포함된 파일은 가져올 수 없습니다.');
      if(x&&typeof x==='object')secrets(x);
    }};
    secrets(value);
    check(value?.format===FORMAT&&Array.isArray(value.courses)&&value.courses.length===2,'지원하는 개인용 코스 파일이 아닙니다.');
    check(/^[a-f0-9]{64}$/.test(version),'파일 식별값을 확인하지 못했습니다.');
    const ids=new Set(),courseIds=new Set();
    return value.courses.map(entry=>{
      const {data,scorecard,mapping}=entry||{},name=names.get(data?.courseId);
      check(name&&!courseIds.has(data.courseId)&&data.course===CLUB&&data.nine===name,'East/West 코스 구분을 확인하세요.');courseIds.add(data.courseId);
      check(scorecard?.courseId===data.courseId&&scorecard.course===CLUB&&scorecard.courseName===name,'코스와 공식 Scorecard가 일치하지 않습니다.');
      check(Array.isArray(mapping)&&mapping.length===18&&Object.keys(data.holes||{}).length===18&&Object.keys(scorecard.holes||{}).length===18,'각 코스에 18개 홀과 검증 매핑이 필요합니다.');
      const numbers=new Set();
      for(const m of mapping){
        check(Number.isInteger(m.holeNumber)&&m.holeNumber>=1&&m.holeNumber<=18&&!numbers.has(m.holeNumber),'홀 번호 중복 또는 누락입니다.');numbers.add(m.holeNumber);
        const h=data.holes[m.holeNumber],s=scorecard.holes[m.holeNumber];
        check(m.courseId===data.courseId&&m.mappingStatus==='documentary_cross_validated'&&m.fieldValidated===false,'검증된 코스–홀 매핑이 필요합니다.');
        check(Number.isInteger(m.holeId)&&!ids.has(m.holeId)&&h?.i===m.holeId&&h.holeId===m.holeId,'East/West Hole ID가 중복되거나 매핑과 다릅니다.');ids.add(m.holeId);
        check(point(h.t)&&point(h.g)&&same(h.t,m.tee)&&same(h.g,m.green),'공통 GI Tee/Green 좌표가 검증 매핑과 다릅니다.');
        check(Array.isArray(h.s)&&h.s.length>0,'홀 GPS 도형이 없습니다.');
        for(const shape of h.s)check(Array.isArray(shape)&&['H','F','G','B','W','P','T'].includes(shape[0])&&[0,1].includes(shape[1])&&Array.isArray(shape[2])&&shape[2].every(point),'GPS 도형 형식을 확인하세요.');
        for(const type of ['F','G','T'])check(h.s.some(x=>x[0]===type&&x[2].length>=3),'필수 Fairway/Green/Tee 도형이 없습니다.');
        check(s&&[null,3,4,5].includes(s.par),'공식 Par는 확정값 또는 null이어야 합니다.');
        for(const tee of ['Blue','White','Red'])check(s[tee]===null||known(s[tee]),'공식 Tee 거리는 확정값 또는 null이어야 합니다.');
        for(const field of ['indexMen','indexLadies'])check(s[field]===null||Number.isInteger(s[field])&&s[field]>=1&&s[field]<=18,'공식 Handicap을 확인하세요.');
        check(Array.isArray(m.unresolvedFields),'미확정 Scorecard 필드가 필요합니다.');
        for(const field of m.unresolvedFields){
          const key={black:'Black',blue:'Blue',white:'White',red:'Red',par:'par',handicap:'indexMen'}[field];
          check(key&&s[key]===null&&(field!=='handicap'||s.indexLadies===null),'Scorecard 충돌값은 null로 유지해야 합니다.');
        }
      }
      return {data:{...data,version:'PRIVATE_GI_'+version},scorecard,mapping};
    });
  }
  async function decode(text){
    check(typeof text==='string'&&text.length<=12000000,'코스 파일이 너무 큽니다.');
    let value;try{value=JSON.parse(text);}catch{fail('JSON 코스 파일을 읽지 못했습니다. 원본 ZIP이 아닌 개인용 JSON을 선택하세요.');}
    const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    return {entries:validate(value,hash),hash};
  }
  async function pack(text){
    if(typeof CompressionStream==='undefined'||typeof DecompressionStream==='undefined')return {encoding:'text',value:text};
    const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {encoding:'gzip-base64',value:btoa(binary)};
  }
  async function unpack(cache){
    if(cache.encoding==='text')return cache.value;
    check(cache.encoding==='gzip-base64'&&typeof DecompressionStream!=='undefined'&&typeof cache.value==='string'&&cache.value.length<=8000000,'이 브라우저에서는 저장된 코스 파일을 다시 불러와야 합니다.');
    const bytes=Uint8Array.from(atob(cache.value),c=>c.charCodeAt(0));
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;
      if(size>12000000){await reader.cancel();fail('기기 코스 저장 크기를 확인하세요.');}chunks.push(value);}
    return new Blob(chunks).text();
  }
  function catalog(){return loaded.map(x=>({course:CLUB,nine:x.data.nine,version:x.data.version,privateLocal:true}));}
  function entry(r){return loaded.find(x=>x.data.nine===r?.nine&&(!r.courseVersion||r.courseVersion===x.data.version));}
  function data(r){return isRound(r)?entry(r)?.data||null:null;}
  function scorecard(r){return isRound(r)?entry(r)?.scorecard||null:null;}
  async function importText(text,{storage,cache=false,rights=false,requiredVersions=[]}={}){
    check(allowed(window.location),'개인용 코스 가져오기는 비공개 Preview 또는 로컬에서만 제공합니다.');
    check(rights,'본인에게 사용 권한이 있는 파일인지 확인하세요.');
    const next=await decode(text);
    const versions=typeof requiredVersions==='function'?requiredVersions():requiredVersions;
    check(versions.every(v=>!v||v==='PRIVATE_GI_'+next.hash),'현재 Group과 다른 버전입니다. 원래 파일을 불러오거나 새 Group으로 시작하세요.');
    if(cache){
      const payload=JSON.stringify({format:FORMAT,...await pack(text),fingerprint:next.hash});
      try{storage.setItem(KEY,payload);check(storage.getItem(KEY)===payload,'저장 확인 실패');}
      catch{fail('기기 저장 공간/권한을 확인하세요. 기존 기록은 유지됩니다. 기기 보관을 해제하면 세션에서만 사용할 수 있습니다.');}
    }else if(storage)storage.removeItem(KEY); // Do not retain an older cache when opting into session-only use.
    loaded=next.entries;fingerprint=next.hash;return catalog();
  }
  async function restore(storage,location){
    if(!allowed(location))return;
    const raw=storage.getItem(KEY);if(raw===null)return;
    check(raw.length<=15000000,'기기 코스 저장 크기를 확인하세요.');
    const cache=JSON.parse(raw);check(cache.format===FORMAT,'기기 코스 저장 형식이 다릅니다.');
    const next=await decode(await unpack(cache));check(next.hash===cache.fingerprint,'기기 코스 파일이 변경되었습니다. 원래 파일을 다시 불러오세요.');
    loaded=next.entries;fingerprint=next.hash;
  }
  function forget(storage){storage.removeItem(KEY);loaded=[];fingerprint=null;}
  function sgMissing(r,h,s,index){
    if(!isRound(r))return null;
    if(!data(r))return '개인용 코스 파일/버전 확인 필요';
    if(![3,4,5].includes(h.par))return '공식 Par 미확정';
    if(index===0&&String(s.startLie).toUpperCase()==='TEE'&&!known(h.teeDistanceM))return '선택 Tee 공식 거리 미확정';
    return null;
  }
  function description(r){
    if(!isRound(r))return '';
    const e=entry(r),missing=e?.mapping.reduce((sum,m)=>sum+m.unresolvedFields.length,0);
    return !e?'개인용 코스 파일을 다시 불러오세요. 기록은 보존됩니다.':
      '개인 기기 테스트 · 문서 교차검증 18홀 · 현장/색상별 Tee GPS 미검증 · 공식 Scorecard 미확정 '+missing+'개';
  }
  const api={KEY,FORMAT,allowed,isRound,validate,decode,catalog,data,scorecard,importText,restore,forget,sgMissing,description};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  window.JGICourseLessonPrivate=Object.freeze(api);
})();
