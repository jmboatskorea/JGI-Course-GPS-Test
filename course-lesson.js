/* Course Lesson Phase 2: isolated, synthetic-only development registration. */
(function(){
  'use strict';
  const STORAGE='jgi_course_lesson_dev_group_v1';
  const PREVIEW_HOST='jgi-course-gps-test-git-ui-course-less-faefbe-jmboatskorea-9766.vercel.app';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const id=(prefix,services)=>prefix+'_'+services.uuid();
  const testName=value=>typeof value==='string'&&value.length<=60&&(value===''||/^TEST\s+\S.*$/.test(value));
  const testContact=value=>typeof value==='string'&&(value===''||/^TEST-(?:TEL|WA)-\d{3}$/.test(value));
  // Pasted text / iPad smart punctuation can contain visually identical dashes.
  const normalizeContactDraft=draft=>({...draft,contact:typeof draft?.contact==='string'
    ?draft.contact.trim().replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g,'-'):draft?.contact});
  function developmentAllowed(location){
    return ['localhost','127.0.0.1','[::1]',PREVIEW_HOST].includes(location.hostname)&&
      new URLSearchParams(location.search).get('courseLessonDev')==='1';
  }
  function validateDraft(draft){
    assert(draft&&testName(draft.name),'이름은 TEST 선수 A처럼 가상 이름을 사용하세요.');
    assert(testContact(draft.contact),'연락처는 TEST-WA-001 또는 TEST-TEL-001 형식만 사용하세요.');
    assert(['FEMALE','MALE'].includes(draft.sex),'성별을 선택하세요.');
    assert(['Blue','White','Red'].includes(draft.tee),'지원하는 티를 선택하세요.');
    assert(typeof draft.handicap==='string'&&draft.handicap.length<=8,'Handicap 입력을 확인하세요.');
  }
  function profileFromDraft(draft){
    draft=normalizeContactDraft(draft);
    validateDraft(draft);
    assert(draft.name.trim()!=='','가상 선수 이름을 입력하세요.');
    assert(draft.handicap.trim()!=='','Handicap을 입력하세요.');
    const handicap=Number(draft.handicap),max=draft.sex==='FEMALE'?28:25;
    assert(Number.isFinite(handicap)&&handicap>=0&&handicap<=max,'Handicap은 0~'+max+' 범위여야 합니다.');
    return {...draft,name:draft.name.trim(),handicap};
  }
  function validateGroup(group){
    assert(group&&group.version===1&&group.mode==='COURSE_LESSON_DEV','지원하지 않는 Group 저장 형식입니다.');
    assert(typeof group.groupId==='string'&&group.groupId.startsWith('clg_'),'Group ID가 올바르지 않습니다.');
    assert(Array.isArray(group.players)&&group.players.length>=1&&group.players.length<=4,'선수는 1~4명이어야 합니다.');
    const ids=new Set([group.groupId]);
    for(const player of group.players){
      for(const [key,prefix] of [['playerId','clp_'],['roundId','clr_']]){
        assert(typeof player[key]==='string'&&player[key].startsWith(prefix)&&!ids.has(player[key]),'선수/Round ID 중복 또는 오류입니다.');
        ids.add(player[key]);
      }
      validateDraft(player.draft);
      assert(typeof player.registered==='boolean','선수 등록 상태를 확인하세요.');
      assert(player.identity?.sharedPlayerId===null&&player.identity?.claimStatus==='NOT_CONNECTED','DB/Guest Claim 연결은 아직 지원하지 않습니다.');
      if(player.registered){
        const p=profileFromDraft({...player.profile,handicap:String(player.profile?.handicap??'')});
        const r=player.round;
        assert(r&&r.id===player.roundId&&r.playerId===player.playerId&&r.groupId===group.groupId,'Round 소유자 정보가 일치하지 않습니다.');
        assert(r.playerName===p.name&&r.playerSex===p.sex&&r.playerHandicap===p.handicap&&r.tee===p.tee,'선수 정보와 Round 정보가 일치하지 않습니다.');
        assert(r.sgBenchmarkMode===(p.sex==='FEMALE'?'FEMALE_PLAYER':'PLAYER'),'Benchmark 설정이 일치하지 않습니다.');
        assert(Array.isArray(r.holes)&&r.holes.length===18&&r.holes.every((h,i)=>h.hole===i+1&&Array.isArray(h.shots)&&Array.isArray(h.puttsDetail)&&Array.isArray(h.penaltyEvents)),'Round의 홀 상태가 올바르지 않습니다.');
        assert(Number.isInteger(r.currentHole)&&r.currentHole>=1&&r.currentHole<=18,'현재 홀 정보가 올바르지 않습니다.');
      }else assert(player.profile===null&&player.round===null,'미등록 선수의 Round가 올바르지 않습니다.');
    }
    assert(group.players.some(p=>p.playerId===group.selectedPlayerId),'선택된 선수가 Group에 없습니다.');
    return group;
  }
  function createGroup(count,services){
    assert(Number.isInteger(count)&&count>=1&&count<=4,'선수는 1~4명이어야 합니다.');
    const players=Array.from({length:count},()=>({
      playerId:id('clp',services),roundId:id('clr',services),
      identity:{kind:'LOCAL_TEST_GUEST',sharedPlayerId:null,claimStatus:'NOT_CONNECTED'},
      registered:false,profile:null,round:null,
      draft:{name:'',contact:'',sex:'FEMALE',handicap:'',tee:'Red'}
    }));
    return validateGroup({version:1,mode:'COURSE_LESSON_DEV',groupId:id('clg',services),
      tournamentId:null,coachId:null,createdAt:services.now(),updatedAt:services.now(),
      course:'Jagorawi Golf & Country Club',nine:'Old Course',selectedPlayerId:players[0].playerId,players});
  }
  function updateDraft(group,playerId,draft){
    draft=normalizeContactDraft(draft);
    validateGroup(group);validateDraft(draft);
    const next=clone(group),player=next.players.find(p=>p.playerId===playerId);
    assert(player,'선수를 찾을 수 없습니다.');player.draft=clone(draft);return next;
  }
  function selectPlayer(group,playerId){
    const next=clone(validateGroup(group));
    assert(next.players.some(p=>p.playerId===playerId),'선수를 찾을 수 없습니다.');
    next.selectedPlayerId=playerId;return next;
  }
  function registerPlayer(group,playerId,draft,services){
    const next=updateDraft(group,playerId,draft),player=next.players.find(p=>p.playerId===playerId);
    const profile=profileFromDraft(draft);
    const mode=profile.sex==='FEMALE'?'FEMALE_PLAYER':'PLAYER';
    const info=services.benchmark({sgBenchmarkMode:mode,playerHandicap:profile.handicap,playerSex:profile.sex});
    assert(info&&!info.fallback&&info.handicap===profile.handicap,'기존 SG 엔진에서 Benchmark를 확인하지 못했습니다.');
    const base=player.round||{version:9,id:player.roundId,playerId,groupId:next.groupId,
      course:next.course,nine:next.nine,courseVersion:services.courseVersion||null,
      lessonRoundStatus:'REGISTERED',startedAt:null,completedAt:null,currentHole:1,pending:null,
      holes:Array.from({length:18},(_,i)=>({hole:i+1,par:null,teeDistanceM:null,strokeIndexMen:null,strokeIndexLadies:null,
        shots:[],putts:0,puttsDetail:[],puttingState:null,penalties:0,penaltyEvents:[],completed:false,review:null})),
      specialEvents:[],analysisSnapshot:null,clubProfile:[]};
    player.profile=profile;player.registered=true;
    player.round=services.hydrate({...base,playerProfileId:playerId,playerName:profile.name,
      playerSex:profile.sex,playerHandicap:profile.handicap,tee:profile.tee,sgBenchmarkMode:mode,
      sgDataVersion:services.dataVersion,sgProfileVersion:info.profileVersion||null,
      sgBaseProfileVersion:info.baseProfileVersion||null,sgBenchmarkSource:info.source||null,
      sgQuality:info.quality||null,sgBenchmarkType:info.benchmarkType||info.type,
      sgBenchmarkHandicap:info.handicap,sgBenchmarkLabel:info.label});
    next.updatedAt=services.now();return validateGroup(next);
  }
  function saveGroup(storage,group){
    const payload=JSON.stringify(validateGroup(group));
    storage.setItem(STORAGE,payload);
    assert(storage.getItem(STORAGE)===payload,'Group 저장 확인에 실패했습니다. 다시 저장하세요.');
  }
  function restoreGroup(storage){
    const raw=storage.getItem(STORAGE);
    if(raw===null)return null;
    assert(raw.length<=2000000,'Group 저장 데이터가 너무 큽니다.');
    return clone(validateGroup(JSON.parse(raw)));
  }
  const api={STORAGE,developmentAllowed,createGroup,updateDraft,selectPlayer,registerPlayer,validateGroup,saveGroup,restoreGroup};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  if(!developmentAllowed(window.location))return;
  function boot(){
    const services={uuid:()=>crypto.randomUUID(),now:()=>Date.now(),
      benchmark:r=>window.sgBenchmarkInfo(r),hydrate:r=>window.hydrateRoundCourseTruth(r),
      courseVersion:window.JGI_OLD_COURSE_DATA?.version||null,dataVersion:window.JGI_SG_BENCHMARK_DATA?.version};
    const host=document.createElement('section');host.className='courseLessonDev';host.id='courseLessonDev';
    host.innerHTML=`<a href="./">← 기존 JGI HOME</a><h1>코스레슨 · 선수 등록</h1>
      <div class="lessonNotice">개발 테스트 전용 · 가상 선수만 사용하세요. 인증/실서비스가 아닙니다.<br>이름: TEST 선수 A · 전화/WhatsApp: TEST-WA-001 또는 TEST-TEL-001. 실제 개인정보 입력 금지.<br>Group은 이 브라우저에만 임시 저장됩니다. 샷 입력·DB/Guest Claim·자동 폐기는 아직 제공하지 않습니다.</div>
      <section class="lessonPanel"><h2>테스트 Group</h2><div class="lessonControls">
        <label>선수 수<select id="lessonPlayerCount"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
        <button type="button" id="lessonCreateGroup">새 테스트 Group 만들기</button>
        <button type="button" id="lessonRestoreGroup">저장된 Group 복원</button></div>
        <div id="lessonGroupMeta" class="lessonMeta"></div><div id="lessonPlayers" class="lessonPlayers" aria-label="선수 선택"></div></section>
      <section class="lessonPanel" id="lessonEditor" hidden><h2 id="lessonPlayerTitle">선수 정보</h2>
        <form id="lessonPlayerForm"><div class="lessonFields">
          <label>가상 선수 이름<input id="lessonName" maxlength="60" placeholder="TEST 선수 A" autocomplete="off" required></label>
          <label>전화번호 / WhatsApp (가상)<input id="lessonContact" maxlength="32" placeholder="TEST-WA-001" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"></label>
          <label>성별<select id="lessonSex"><option value="FEMALE">여성</option><option value="MALE">남성</option></select></label>
          <label>Handicap<input id="lessonHandicap" type="number" min="0" max="28" step="0.1" required></label>
          <label>티<select id="lessonTee"><option value="Red">Red</option><option value="White">White</option><option value="Blue">Blue</option></select></label>
        </div><div class="lessonBench" id="lessonBenchmark"></div><div class="lessonActions">
          <button type="submit" id="lessonRegisterPlayer">선수 등록 / 변경 저장</button>
          <button type="button" id="lessonSaveGroup">Group 임시 저장</button></div></form>
        <div id="lessonRoundMeta" class="lessonMeta"></div></section>
      <div id="lessonStatus" class="lessonStatus" role="status" aria-live="polite"></div>`;
    document.body.prepend(host);document.body.classList.add('course-lesson-dev');
    const el=id=>host.querySelector('#'+id);let group=null;
    const status=(message,error=false)=>{el('lessonStatus').textContent=message;el('lessonStatus').dataset.error=String(error);};
    const readDraft=()=>({name:el('lessonName').value,contact:el('lessonContact').value,sex:el('lessonSex').value,handicap:el('lessonHandicap').value,tee:el('lessonTee').value});
    function previewBenchmark(){
      el('lessonHandicap').max=el('lessonSex').value==='FEMALE'?'28':'25';
      try{
        const draft=readDraft(),h=Number(draft.handicap),max=draft.sex==='FEMALE'?28:25;
        assert(draft.handicap!==''&&Number.isFinite(h)&&h>=0&&h<=max,'Handicap을 입력하면 기존 SG 기준을 표시합니다.');
        const info=services.benchmark({sgBenchmarkMode:draft.sex==='FEMALE'?'FEMALE_PLAYER':'PLAYER',playerHandicap:h});
        el('lessonBenchmark').textContent='자동 Benchmark: '+info.label+' · '+info.type+' · 기존 SG 엔진';
      }catch(e){el('lessonBenchmark').textContent=e.message;}
    }
    function render(){
      el('lessonEditor').hidden=!group;el('lessonPlayers').replaceChildren();
      if(!group){el('lessonGroupMeta').textContent='선수 1~4명의 테스트 Group을 만드세요.';return;}
      el('lessonPlayerCount').value=String(group.players.length);
      const registered=group.players.filter(p=>p.registered).length;
      el('lessonGroupMeta').textContent='Group ID: '+group.groupId+' · 등록 '+registered+'/'+group.players.length+' · '+group.course+' / '+group.nine;
      group.players.forEach((player,i)=>{
        const button=document.createElement('button');button.type='button';button.className='lessonPlayer';button.dataset.playerId=player.playerId;
        button.setAttribute('aria-pressed',String(player.playerId===group.selectedPlayerId));
        const name=document.createElement('strong');name.textContent=player.profile?.name||'선수 '+(i+1)+' · 미등록';
        const details=document.createElement('small');details.textContent=player.registered?player.round.sgBenchmarkLabel+' · '+player.profile.tee:'선수 정보를 입력하세요.';
        button.append(name,details);button.addEventListener('click',()=>{
          try{const next=selectPlayer(updateDraft(group,group.selectedPlayerId,readDraft()),player.playerId);commit(next,'선수 전환 완료 · 입력 상태 유지');}catch(e){status(e.message,true);}
        });el('lessonPlayers').append(button);
      });
      const p=group.players.find(p=>p.playerId===group.selectedPlayerId);
      el('lessonPlayerTitle').textContent='선수 '+(group.players.indexOf(p)+1)+' · '+(p.registered?'등록됨':'미등록');
      for(const [field,key] of [['lessonName','name'],['lessonContact','contact'],['lessonSex','sex'],['lessonHandicap','handicap'],['lessonTee','tee']])el(field).value=p.draft[key];
      el('lessonRoundMeta').textContent='Player ID: '+p.playerId+' · Round ID: '+p.roundId+' · '+(p.round?'독립 Round 준비됨 (샷 입력 미제공)':'선수 등록 후 독립 Round 준비');
      previewBenchmark();
    }
    function commit(next,message){
      next.updatedAt=services.now();saveGroup(localStorage,next);group=next;render();status(message);
    }
    el('lessonCreateGroup').addEventListener('click',()=>{
      try{if(localStorage.getItem(STORAGE)!==null&&!confirm('기존 테스트 Group 임시 저장을 새 Group으로 바꿀까요? 기존 Player Round는 유지됩니다.'))return;
        commit(createGroup(Number(el('lessonPlayerCount').value),services),'새 테스트 Group 생성 · 각 선수를 등록하세요.');
      }catch(e){status('Group 생성 실패: '+e.message,true);}
    });
    function restore(){
      try{const saved=restoreGroup(localStorage);group=saved;render();status(saved?'저장된 Group 복원 완료':'저장된 테스트 Group이 없습니다.');}
      catch(e){status('Group 복원 실패 · 원본 저장은 유지됩니다: '+e.message,true);}
    }
    el('lessonRestoreGroup').addEventListener('click',()=>{if(group&&!confirm('저장하지 않은 입력을 저장된 Group으로 복원할까요?'))return;restore();});
    el('lessonSaveGroup').addEventListener('click',()=>{try{commit(updateDraft(group,group.selectedPlayerId,readDraft()),'Group 임시 저장 완료 · 미등록 입력도 보존');}catch(e){status('Group 저장 실패: '+e.message,true);}});
    el('lessonPlayerForm').addEventListener('submit',event=>{
      event.preventDefault();try{commit(registerPlayer(group,group.selectedPlayerId,readDraft(),services),'선수 등록/변경 및 Group 저장 완료');}catch(e){status('선수 저장 실패: '+e.message,true);}
    });
    el('lessonPlayerForm').addEventListener('input',()=>{previewBenchmark();status('입력 변경 중 · 등록 또는 Group 임시 저장으로 보존하세요.');});
    restore();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
