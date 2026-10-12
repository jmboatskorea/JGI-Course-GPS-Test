/* Course Lesson development: isolated registration and Phase 3A physical shots. */
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
        if(player.shotDraft)validateShotDraft(player.shotDraft,r.currentHole);
        if(player.ballPosition)validatePosition(player.ballPosition);
        r.holes.forEach(h=>h.shots.forEach((shot,i)=>{
          if(shot.status!=='PENDING_RESULT')return; // Keep legacy Phase 2 snapshots readable.
          assert(typeof shot.id==='string'&&shot.id.startsWith('cls_')&&!ids.has(shot.id),'Shot ID 중복 또는 오류입니다.');ids.add(shot.id);
          assert(shot.playerId===player.playerId&&shot.roundId===player.roundId&&shot.groupId===group.groupId&&shot.hole===h.hole&&shot.shotSequence===i+1,'Shot 소유자/순서가 일치하지 않습니다.');
          validatePosition(shot.start);
          assert(shot.end===null&&shot.sg===null&&shot.distanceM===null,'Pending Shot의 종료 정보/SG를 생성할 수 없습니다.');
        }));
        if(r.pending?.status==='PENDING_RESULT')assert(r.holes.some(h=>h.shots.some(s=>s.id===r.pending.id&&s.status==='PENDING_RESULT')),'Pending Shot 참조를 찾을 수 없습니다.');
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
  function validatePosition(point){
    assert(point&&Number.isFinite(point.lat)&&Math.abs(point.lat)<=90&&Number.isFinite(point.lng)&&Math.abs(point.lng)<=180,'유효한 볼 좌표가 필요합니다.');
    assert(Number.isFinite(point.time)&&point.time>0,'위치 측정 시각이 필요합니다.');
    assert(point.source==='GPS'||point.source==='MANUAL_DROP','위치 입력 출처를 확인하세요.');
    if(point.source==='GPS')assert(Number.isFinite(point.accuracy)&&point.accuracy>=0,'GPS 정확도가 필요합니다.');
    else assert(point.accuracy===null&&point.inputMethod==='MAP_TOUCH','Map Touch 정확도는 GPS 측정값이 아닙니다.');
    return point;
  }
  const emptyShotDraft=hole=>({hole,club:'DR',position:null,confirmed:false,confirmationId:null});
  function validateShotDraft(draft,hole){
    assert(draft.hole===hole&&typeof draft.club==='string'&&draft.club.length<=12&&draft.club!=='Putter','선수별 홀/클럽 입력을 확인하세요.');
    if(draft.position)validatePosition(draft.position);
    assert(typeof draft.confirmed==='boolean','위치 확인 상태를 확인하세요.');
    if(draft.confirmed)assert(draft.position&&typeof draft.confirmationId==='string'&&draft.confirmationId.startsWith('clpos_'),'기록원의 위치 확인이 필요합니다.');
    return draft;
  }
  function shotPlayer(group,playerId){
    const p=group.players.find(p=>p.playerId===playerId);
    assert(p?.registered&&p.round,'등록된 선수를 선택하세요.');
    p.shotDraft=p.shotDraft||emptyShotDraft(p.round.currentHole);return p;
  }
  function setShotClub(group,playerId,club,services){
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId);
    assert(services.clubs.includes(club)&&club!=='Putter','지원하는 샷 클럽을 선택하세요.');
    p.shotDraft.club=club;return next;
  }
  function chooseHole(group,playerId,hole){
    assert(Number.isInteger(hole)&&hole>=1&&hole<=18,'홀은 1~18 범위여야 합니다.');
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId);
    if(p.round.currentHole!==hole){p.round.currentHole=hole;p.shotDraft={...emptyShotDraft(hole),club:p.shotDraft.club};}
    return next;
  }
  function stagePosition(group,playerId,point){
    validatePosition(point);
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId);
    p.shotDraft.position=clone(point);p.shotDraft.confirmed=false;p.shotDraft.confirmationId=null;
    return next;
  }
  function confirmPosition(group,playerId,services){
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId);
    validatePosition(p.shotDraft.position);
    p.shotDraft.confirmed=true;p.shotDraft.confirmationId=id('clpos',services);
    p.shotDraft.position.confirmedAt=services.now();p.ballPosition=clone(p.shotDraft.position);
    return next;
  }
  function recordShot(group,playerId,services){
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId),r=p.round,d=p.shotDraft;
    assert(d.confirmed&&d.position&&d.confirmationId,'볼 위치를 기록원이 확인한 뒤 SHOT SAVE 하세요.');
    assert(services.clubs.includes(d.club)&&d.club!=='Putter','사용 클럽을 선택하세요.');
    assert(!r.holes.some(h=>h.shots.some(s=>s.confirmationId===d.confirmationId)),'이미 저장된 Physical Shot입니다.');
    const h=r.holes[r.currentHole-1],time=services.now();
    const context=services.shotContext(r,clone(d.position),d.club);
    const shot={id:'cls_'+d.confirmationId.slice('clpos_'.length),playerId:p.playerId,roundId:r.id,groupId:next.groupId,
      hole:r.currentHole,holeId:context.holeId??null,shotSequence:h.shots.length+1,strokeKind:'SHOT',physicalStroke:true,
      club:d.club,start:clone(d.position),end:null,startLie:'UNKNOWN',endLie:'UNKNOWN',holed:false,
      distanceM:null,createdAt:time,startedAt:time,startLockedAt:d.position.confirmedAt,updatedAt:time,
      confirmationId:d.confirmationId,positionSource:{start:d.position.source,end:null},
      courseContext:{...context,endGreenDistanceM:null},status:'PENDING_RESULT',result:null,sg:null,
      target:null,targetZone:null,targetSource:null,shotIntent:null,playerState:null,editHistory:[]};
    h.shots.push(shot);h.startedAt=h.startedAt||time;
    r.startedAt=r.startedAt||time;r.lessonRoundStatus='IN_PROGRESS';r.analysisSnapshot=null;
    // Pointer only: the physical stroke exists once, in holes[].shots[].
    r.pending={id:shot.id,hole:r.currentHole,shotSequence:shot.shotSequence,status:'PENDING_RESULT',result:null};
    p.shotDraft={...emptyShotDraft(r.currentHole),club:d.club};next.updatedAt=time;
    return validateGroup(next);
  }
  const api={STORAGE,developmentAllowed,createGroup,updateDraft,selectPlayer,registerPlayer,validateGroup,saveGroup,restoreGroup,
    setShotClub,chooseHole,stagePosition,confirmPosition,recordShot};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  if(!developmentAllowed(window.location))return;
  let sharedMap=null,mapController=null,mapError=null;
  // Installed before the Player script loads Maps, so its listeners never own lesson clicks.
  window.JGI_COURSE_LESSON_MAP={onReady:map=>{sharedMap=map;mapController?.attach(map);},
    onError:message=>{mapError=message;mapController?.unavailable(message);}};
  function boot(){
    const services={uuid:()=>crypto.randomUUID(),now:()=>Date.now(),
      benchmark:r=>window.sgBenchmarkInfo(r),hydrate:r=>window.hydrateRoundCourseTruth(r),
      courseVersion:window.JGI_OLD_COURSE_DATA?.version||null,dataVersion:window.JGI_SG_BENCHMARK_DATA?.version,
      clubs:DEFAULT_MASTER_CLUBS.filter(c=>c.name!=='Putter').map(c=>c.name),
      shotContext:(r,start,club)=>{
        const data=window.activeCourseData(r),ch=data?.holes?.[String(r.currentHole)],h=r.holes[r.currentHole-1];
        const carry=r.clubProfile?.find(c=>c.name===club)?.carry??null;
        const distance=ch?.g?window.hav(start,{lat:ch.g[0],lng:ch.g[1]}):null;
        return {course:r.course,courseId:data?.courseId??null,hole:r.currentHole,holeId:ch?.i??ch?.id??null,
          geometryVersion:data?.version||r.courseVersion,courseIntelligenceVersion:COURSE_INTELLIGENCE_VERSION,
          tee:r.tee,greenDistanceM:distance,startGreenDistanceM:distance,
          ...window.deriveCourseIntelligence(ch,start,carry,null,h.par,r),
          sgBenchmarkVersion:r.sgDataVersion,sgBenchmarkProfileVersion:r.sgProfileVersion,
          sgBenchmarkMode:r.sgBenchmarkMode,sgBenchmarkHandicap:r.playerHandicap};
      }};
    const host=document.createElement('section');host.className='courseLessonDev';host.id='courseLessonDev';
    host.innerHTML=`<a href="./">← 기존 JGI HOME</a><h1>코스레슨 · 선수 등록</h1>
      <div class="lessonNotice">개발 테스트 전용 · 가상 선수만 사용하세요. 인증/실서비스가 아닙니다.<br>이름: TEST 선수 A · 전화/WhatsApp: TEST-WA-001 또는 TEST-TEL-001. 실제 개인정보 입력 금지.<br>Group은 이 브라우저에만 임시 저장됩니다. 샷 종료·Putting·Penalty·DB/Guest Claim·자동 폐기는 아직 제공하지 않습니다.</div>
      <section class="lessonPanel"><h2>테스트 Group</h2><div class="lessonControls">
        <label>선수 수<select id="lessonPlayerCount"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
        <button type="button" id="lessonCreateGroup">새 테스트 Group 만들기</button>
        <button type="button" id="lessonRestoreGroup">저장된 Group 복원</button></div>
        <div id="lessonGroupMeta" class="lessonMeta"></div><div id="lessonPlayers" class="lessonPlayers" aria-label="선수 선택"></div></section>
      <section class="lessonPanel" id="lessonShotPanel" hidden><h2 id="lessonShotPlayer">선수별 샷 기록</h2>
        <div class="lessonControls"><label>선택 선수의 현재 홀<select id="lessonHole"></select></label>
          <button type="button" id="lessonJgiMap">JGI 코스 지도</button><button type="button" id="lessonSatellite" disabled>위성 지도</button></div>
        <p class="lessonMeta">지도를 탭하면 선택 선수의 볼 위치 후보가 됩니다. GPS도 후보로만 표시하며, 기록원이 확인해야 저장할 수 있습니다.</p>
        <div id="lessonMapStatus" class="lessonMeta" role="status"></div>
        <div class="lessonMapHost"><svg id="lessonCourseSvg" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid meet" aria-label="공통 코스 지도 · 탭하여 볼 위치 후보 지정"></svg><div id="lessonSatelliteMap" hidden></div></div>
        <div id="lessonMarkerLegend" class="lessonMeta"></div>
        <div class="lessonActions"><button type="button" id="lessonGetGps">기록원 GPS 후보 가져오기</button><button type="button" id="lessonConfirmPosition" disabled>선택 선수의 볼 위치 확인</button></div>
        <div id="lessonPosition" class="lessonMeta" aria-live="polite"></div>
        <div class="lessonControls"><label>사용 클럽<select id="lessonShotClub"></select></label><button type="button" id="lessonShotSave" disabled>SHOT SAVE · Physical Shot 1회</button></div>
        <p class="lessonMeta">실제로 친 샷을 한 번만 저장하세요. 종료 위치는 자동 확정하지 않으며 Pending Result 동안 SG는 계산하지 않습니다.</p>
        <div id="lessonShotHistory" class="lessonShotHistory" aria-live="polite"></div></section>
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
    const currentInput=()=>updateDraft(group,group.selectedPlayerId,readDraft());
    for(let i=1;i<=18;i++){const option=document.createElement('option');option.value=String(i);option.textContent=i+'번 홀';el('lessonHole').append(option);}
    services.clubs.forEach(club=>{const option=document.createElement('option');option.value=club;option.textContent=club;el('lessonShotClub').append(option);});
    mapController=window.JGICourseLessonMapController(host,()=>group,point=>{
      try{commit(stagePosition(currentInput(),group.selectedPlayerId,point),'Map Touch 위치 후보 저장 · 볼 위치를 확인하세요.');}catch(e){status(e.message,true);}
    });
    if(sharedMap)mapController.attach(sharedMap);if(mapError)mapController.unavailable(mapError);
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
      if(!group){el('lessonGroupMeta').textContent='선수 1~4명의 테스트 Group을 만드세요.';el('lessonShotPanel').hidden=true;mapController.render();return;}
      el('lessonPlayerCount').value=String(group.players.length);
      const registered=group.players.filter(p=>p.registered).length;
      el('lessonGroupMeta').textContent='Group ID: '+group.groupId+' · 등록 '+registered+'/'+group.players.length+' · '+group.course+' / '+group.nine;
      group.players.forEach((player,i)=>{
        const button=document.createElement('button');button.type='button';button.className='lessonPlayer';button.dataset.playerId=player.playerId;
        button.setAttribute('aria-pressed',String(player.playerId===group.selectedPlayerId));
        const name=document.createElement('strong');name.textContent=player.profile?.name||'선수 '+(i+1)+' · 미등록';
        const details=document.createElement('small');
        const shots=player.round?.holes.flatMap(h=>h.shots)||[];
        details.textContent=player.registered?String.fromCharCode(65+i)+' · '+player.round.sgBenchmarkLabel+' · '+player.profile.tee+' · Shot '+shots.length+' / Pending '+shots.filter(s=>s.status==='PENDING_RESULT').length:'선수 정보를 입력하세요.';
        button.append(name,details);button.addEventListener('click',()=>{
          try{const next=selectPlayer(updateDraft(group,group.selectedPlayerId,readDraft()),player.playerId);commit(next,'선수 전환 완료 · 입력 상태 유지');}catch(e){status(e.message,true);}
        });el('lessonPlayers').append(button);
      });
      const p=group.players.find(p=>p.playerId===group.selectedPlayerId);
      el('lessonPlayerTitle').textContent='선수 '+(group.players.indexOf(p)+1)+' · '+(p.registered?'등록됨':'미등록');
      for(const [field,key] of [['lessonName','name'],['lessonContact','contact'],['lessonSex','sex'],['lessonHandicap','handicap'],['lessonTee','tee']])el(field).value=p.draft[key];
      el('lessonRoundMeta').textContent='Player ID: '+p.playerId+' · Round ID: '+p.roundId+' · '+(p.round?'독립 Round · '+p.round.lessonRoundStatus:'선수 등록 후 독립 Round 준비');
      previewBenchmark();
      el('lessonShotPanel').hidden=!p.registered;
      if(p.registered){
        const draft=p.shotDraft||emptyShotDraft(p.round.currentHole),letter=String.fromCharCode(65+group.players.indexOf(p));
        el('lessonShotPlayer').textContent=letter+' · '+p.profile.name+' · 샷 기록';
        el('lessonHole').value=String(p.round.currentHole);el('lessonShotClub').value=draft.club;
        el('lessonConfirmPosition').disabled=!draft.position||draft.confirmed;el('lessonShotSave').disabled=!draft.confirmed;
        el('lessonPosition').textContent=draft.position?(draft.confirmed?'확인됨':'미확인 후보')+' · '+draft.position.lat.toFixed(6)+', '+draft.position.lng.toFixed(6)+' · '+(draft.position.source==='GPS'?'GPS ±'+draft.position.accuracy+'m':'MAP TOUCH · GPS 정확도 없음'):'볼 위치 후보를 지정하세요.';
        el('lessonShotHistory').replaceChildren();
        p.round.holes[p.round.currentHole-1].shots.forEach(shot=>{const row=document.createElement('div');row.textContent='Shot '+shot.shotSequence+' · '+shot.club+' · '+(shot.start?.source==='GPS'?'GPS':'MAP TOUCH')+' · PENDING RESULT · SG 미계산';el('lessonShotHistory').append(row);});
      }
      mapController.render();
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
    el('lessonHole').addEventListener('change',()=>{try{commit(chooseHole(currentInput(),group.selectedPlayerId,Number(el('lessonHole').value)),'선택 선수의 현재 홀 변경 · 이전 Shot/Pending 유지');}catch(e){status(e.message,true);}});
    el('lessonShotClub').addEventListener('change',()=>{try{commit(setShotClub(currentInput(),group.selectedPlayerId,el('lessonShotClub').value,services),'선수별 클럽 선택 저장');}catch(e){status(e.message,true);}});
    el('lessonConfirmPosition').addEventListener('click',()=>{try{commit(confirmPosition(currentInput(),group.selectedPlayerId,services),'기록원이 선택 선수의 볼 위치를 확인했습니다.');}catch(e){status(e.message,true);}});
    el('lessonShotSave').addEventListener('click',()=>{try{commit(recordShot(currentInput(),group.selectedPlayerId,services),'Physical Shot 1회 저장 · PENDING RESULT · SG 미계산');}catch(e){status('Shot 저장 실패: '+e.message,true);}});
    el('lessonGetGps').addEventListener('click',()=>{
      if(!navigator.geolocation){status('이 브라우저는 GPS를 지원하지 않습니다. Map Touch를 사용하세요.',true);return;}
      const playerId=group.selectedPlayerId,groupId=group.groupId,requestedHole=group.players.find(p=>p.playerId===playerId).round.currentHole;
      el('lessonGetGps').disabled=true;status('기록원 GPS를 가져오는 중 · 볼 위치는 자동 확정하지 않습니다.');
      navigator.geolocation.getCurrentPosition(position=>{
        el('lessonGetGps').disabled=false;
        try{assert(group?.groupId===groupId&&group.players.find(p=>p.playerId===playerId)?.round?.currentHole===requestedHole,'GPS 요청 후 Group/홀이 변경됐습니다. 다시 위치를 가져오세요.');
          const point={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,time:position.timestamp,source:'GPS'};
          commit(stagePosition(currentInput(),playerId,point),'요청한 선수의 GPS 후보 저장 · 기록원이 볼 위치를 확인하세요.');
        }catch(e){status('GPS 후보 저장 실패: '+e.message,true);}
      },error=>{el('lessonGetGps').disabled=false;status((error.code===1?'GPS 권한이 필요합니다.':'GPS 위치를 가져오지 못했습니다.')+' Map Touch를 사용할 수 있습니다.',true);},
      {enableHighAccuracy:true,maximumAge:0,timeout:15000});
    });
    restore();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else boot();
})();
