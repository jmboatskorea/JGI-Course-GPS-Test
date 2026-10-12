/* Course Lesson development: isolated registration, physical shots and results. */
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
    for(const [hole,pin] of Object.entries(group.holePins||{})){
      assert(/^(?:[1-9]|1[0-8])$/.test(hole),'PIN의 홀 정보가 올바르지 않습니다.');validatePin(pin);
      assert(pin.hole===Number(hole)&&pin.groupId===group.groupId&&pin.isSurveyed===false,'PIN 소유자/출처를 확인하세요.');
    }
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
          if(!['PENDING_RESULT','RESULT_CONFIRMED'].includes(shot.status))return; // Keep legacy Phase 2 snapshots readable.
          assert(typeof shot.id==='string'&&shot.id.startsWith('cls_')&&!ids.has(shot.id),'Shot ID 중복 또는 오류입니다.');ids.add(shot.id);
          assert(shot.playerId===player.playerId&&shot.roundId===player.roundId&&shot.groupId===group.groupId&&shot.hole===h.hole&&shot.shotSequence===i+1,'Shot 소유자/순서가 일치하지 않습니다.');
          validatePosition(shot.start);
          assert(shot.sg===null,'코스레슨 SG 종합 검증은 아직 제공하지 않습니다.');
          if(shot.status==='PENDING_RESULT')assert(shot.end===null&&shot.distanceM===null&&!shot.holed,'Pending Shot의 종료 정보를 생성할 수 없습니다.');
          else{
            assert(['NEXT_SHOT_START','ON_GREEN','HOLED'].includes(shot.result?.type)&&Array.isArray(shot.editHistory),'Shot 결과/수정 이력을 확인하세요.');
            if(shot.holed)assert(shot.end===null&&shot.endLie==='HOLED'&&shot.endState==='HOLED'&&shot.result.type==='HOLED','홀인 상태가 일치하지 않습니다.');
            else{validatePosition(shot.end);assert(shot.result.type!=='HOLED','Shot 종료 상태가 일치하지 않습니다.');}
            if(shot.result.type==='ON_GREEN')assert(shot.endLie==='GREEN'&&shot.endState==='ON_GREEN','ON GREEN 상태가 일치하지 않습니다.');
            if(shot.originalEnd)validatePosition(shot.originalEnd);
          }
        }));
        r.holes.forEach(h=>{
          if(h.lessonStatus==='AWAITING_PUTTING'){
            const entry=h.shots.find(s=>s.id===h.puttingReady?.entryShotId);
            assert(!h.completed&&entry?.result?.type==='ON_GREEN'&&h.puttingReady.status==='AWAITING_INPUT'&&
              (h.puttingReady.firstPuttDistanceM===null||h.puttingReady.firstPuttDistanceM===h.puttsDetail[0]?.distanceM),'Putting 준비 상태가 올바르지 않습니다.');
            validatePosition(h.puttingReady.ballPosition);
          }
          if(h.puttingReady?.distanceInput!==undefined){
            const ready=h.puttingReady;
            assert(typeof ready.distanceInput==='string'&&ready.distanceInput.length<=24&&ready.distanceM===puttDistance(ready.distanceInput),'퍼팅 거리 입력 상태가 올바르지 않습니다.');
            assert(ready.distanceM===null||typeof ready.inputId==='string'&&ready.inputId.startsWith('clpd_'),'퍼팅 입력 ID를 확인하세요.');
          }
          if(h.puttsDetail.some(putt=>putt.strokeKind==='PUTT')){
            assert(h.putts===h.puttsDetail.length&&h.shots.some(s=>s.id===h.puttingReady?.entryShotId&&s.result?.type==='ON_GREEN'),'퍼팅 수/ON GREEN 연결이 일치하지 않습니다.');
            h.puttsDetail.forEach((putt,i)=>{
              assert(putt.strokeKind==='PUTT'&&putt.physicalStroke===true&&putt.id==='clputt_'+putt.inputId?.slice(5)&&!ids.has(putt.id),'퍼팅 ID 중복 또는 오류입니다.');ids.add(putt.id);
              assert(putt.playerId===player.playerId&&putt.roundId===r.id&&putt.groupId===group.groupId&&putt.hole===h.hole&&putt.number===i+1,'퍼팅 소유자/순서가 일치하지 않습니다.');
              assert(Number.isFinite(putt.distanceM)&&putt.distanceM>=0.1&&['HOLED','SHORT','LONG'].includes(putt.result)&&putt.sg===null,'퍼팅 거리/결과/SG를 확인하세요.');
              assert(putt.result!=='HOLED'||i===h.puttsDetail.length-1&&h.completed,'HOLED 뒤에 퍼팅을 추가할 수 없습니다.');
            });
            assert(h.completed===(h.puttsDetail.at(-1).result==='HOLED'),'퍼팅 홀 완료 상태가 일치하지 않습니다.');
            assert(h.puttingReady.status===(h.completed?'HOLED':'AWAITING_INPUT')&&h.firstPutt===h.puttsDetail[0].distanceM&&
              h.puttingReady.firstPuttDistanceM===h.firstPutt&&h.score===h.shots.length+h.putts+(h.penalties||0),'퍼팅 준비/Score 상태가 일치하지 않습니다.');
          }
          if(h.lessonStatus==='HOLED')assert(h.completed&&(h.shots.some(s=>s.holed===true)||h.puttsDetail.at(-1)?.result==='HOLED')&&h.score===h.shots.length+(h.putts||0)+(h.penalties||0),'Hole 완료 상태가 일치하지 않습니다.');
        });
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
  function playableHole(player){
    const h=player.round.holes[player.round.currentHole-1];
    assert(!h.completed,'이 선수의 홀은 완료됐습니다. 다음 홀을 선택하세요.');
    assert(h.lessonStatus!=='AWAITING_PUTTING','ON GREEN 저장 완료 · 퍼팅 거리와 결과를 입력하세요.');
    return h;
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
    playableHole(p);
    p.shotDraft.position=clone(point);p.shotDraft.confirmed=false;p.shotDraft.confirmationId=null;
    return next;
  }
  function confirmPosition(group,playerId,services){
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId);
    const h=playableHole(p),previous=h.shots.at(-1);
    validatePosition(p.shotDraft.position);
    p.shotDraft.confirmed=true;p.shotDraft.confirmationId=id('clpos',services);
    p.shotDraft.position.confirmedAt=services.now();p.ballPosition=clone(p.shotDraft.position);
    // Only the immediate predecessor in this player's current hole is eligible.
    // Never backfill earlier Phase 3A pending shots or another hole/player.
    if(previous?.status==='PENDING_RESULT'||(previous?.id===p.shotDraft.linkedShotId&&previous?.result?.type==='NEXT_SHOT_START')){
      finishShotEnd(previous,p.shotDraft.position,'NEXT_SHOT_START',services);
      previous.result.confirmationId=p.shotDraft.confirmationId;p.shotDraft.linkedShotId=previous.id;
      if(p.round.pending?.id===previous.id)p.round.pending=null;
    }
    next.updatedAt=services.now();return validateGroup(next);
  }
  function recordShot(group,playerId,services){
    const next=clone(validateGroup(group)),p=shotPlayer(next,playerId),r=p.round,d=p.shotDraft;
    const h=playableHole(p);
    assert(d.confirmed&&d.position&&d.confirmationId,'볼 위치를 기록원이 확인한 뒤 SHOT SAVE 하세요.');
    assert(services.clubs.includes(d.club)&&d.club!=='Putter','사용 클럽을 선택하세요.');
    assert(!r.holes.some(h=>h.shots.some(s=>s.confirmationId===d.confirmationId)),'이미 저장된 Physical Shot입니다.');
    const time=services.now();
    const context=services.shotContext(r,clone(d.position),d.club);
    const shot={id:'cls_'+d.confirmationId.slice('clpos_'.length),playerId:p.playerId,roundId:r.id,groupId:next.groupId,
      hole:r.currentHole,holeId:context.holeId??null,shotSequence:h.shots.length+1,strokeKind:'SHOT',physicalStroke:true,
      club:d.club,start:clone(d.position),end:null,startLie:'UNKNOWN',endLie:'UNKNOWN',holed:false,
      distanceM:null,createdAt:time,startedAt:time,startLockedAt:d.position.confirmedAt,updatedAt:time,
      confirmationId:d.confirmationId,positionSource:{start:d.position.source,end:null},
      courseContext:{...context,endGreenDistanceM:null},status:'PENDING_RESULT',result:null,sg:null,
      target:null,targetZone:null,targetSource:null,shotIntent:null,playerState:null,editHistory:[]};
    if(d.linkedShotId){
      const previous=h.shots.at(-1);
      assert(previous?.id===d.linkedShotId&&previous.result?.confirmationId===d.confirmationId,'직전 Shot과 시작 위치의 연결을 확인하세요.');
      previous.result.nextShotId=shot.id;shot.previousShotId=previous.id;
    }
    h.shots.push(shot);h.startedAt=h.startedAt||time;
    r.startedAt=r.startedAt||time;r.lessonRoundStatus='IN_PROGRESS';r.analysisSnapshot=null;
    // Pointer only: the physical stroke exists once, in holes[].shots[].
    r.pending={id:shot.id,hole:r.currentHole,shotSequence:shot.shotSequence,status:'PENDING_RESULT',result:null};
    p.shotDraft={...emptyShotDraft(r.currentHole),club:d.club};next.updatedAt=time;
    return validateGroup(next);
  }
  function validatePin(pin){
    assert(pin?.source==='SCORER_MANUAL_MAP','PIN 출처는 SCORER_MANUAL_MAP이어야 합니다.');
    validatePosition({...pin,source:'MANUAL_DROP'});return pin;
  }
  function greenGeometry(round,hole,services){
    const geometry=services.greenGeometry(round,hole);
    assert(geometry?.hole===hole&&Array.isArray(geometry.polygons)&&geometry.polygons.length>0,'이 홀의 GI Green Polygon이 없습니다. 임의 Green은 생성하지 않습니다.');
    for(const polygon of geometry.polygons){
      assert(Array.isArray(polygon)&&polygon.length>=3&&polygon.every(p=>Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180),'GI Green 좌표를 확인하세요.');
    }
    return geometry;
  }
  function pointInGreen(point,geometry){
    return geometry.polygons.some(polygon=>{
      let inside=false;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const a=polygon[j],b=polygon[i],cross=(point.lng-a.lng)*(b.lat-a.lat)-(point.lat-a.lat)*(b.lng-a.lng);
        if(Math.abs(cross)<1e-14&&point.lng>=Math.min(a.lng,b.lng)-1e-10&&point.lng<=Math.max(a.lng,b.lng)+1e-10&&point.lat>=Math.min(a.lat,b.lat)-1e-10&&point.lat<=Math.max(a.lat,b.lat)+1e-10)return true;
        if((a.lat>point.lat)!==(b.lat>point.lat)&&point.lng<(b.lng-a.lng)*(point.lat-a.lat)/(b.lat-a.lat)+a.lng)inside=!inside;
      }
      return inside;
    });
  }
  function finishShotEnd(shot,point,type,services){
    const at=services.now(),{editHistory,...saved}=shot,previous=clone(saved);
    if(point&&!shot.originalEnd)shot.originalEnd=clone(point);
    shot.end=point?clone(point):null;shot.endLie=type==='HOLED'?'HOLED':type==='ON_GREEN'?'GREEN':'UNKNOWN';
    shot.endState=type==='HOLED'?'HOLED':type==='ON_GREEN'?'ON_GREEN':'POSITION_CONFIRMED';shot.holed=type==='HOLED';
    shot.positionSource.end=point?.source||null;shot.updatedAt=at;shot.status='RESULT_CONFIRMED';
    shot.distanceM=point&&services.distance?services.distance(shot.start,point):null;shot.sg=null;
    shot.courseContext.endGreenDistanceM=type==='HOLED'?0:null;
    shot.result={type,confirmedAt:at,source:'SCORER_CONFIRMED',endLie:shot.endLie,holed:shot.holed};
    if(type==='HOLED')shot.result.endExpectedStrokes=0;
    shot.editHistory.push({at,type:previous.status==='RESULT_CONFIRMED'?'END_POSITION_CORRECTED':type,source:'SCORER_CONFIRMATION',previous,next:{end:clone(shot.end),endLie:shot.endLie,endState:shot.endState}});
  }
  function resultShot(group,playerId,shotId){
    const p=shotPlayer(group,playerId),h=playableHole(p),shot=resultTargetShot(p,shotId);
    assert(shot,'현재 선수/홀의 저장된 Pending Shot 또는 다음 시작으로 연결된 Shot을 선택하세요.');
    return {p,h,shot};
  }
  function onGreen(group,playerId,shotId,point,pin,services){
    const next=clone(validateGroup(group)),{p,h,shot}=resultShot(next,playerId,shotId);
    const geometry=greenGeometry(p.round,h.hole,services);validatePosition(point);
    assert(point.source==='MANUAL_DROP'&&pointInGreen(point,geometry),'현재 홀의 GI Green 안에서 볼 위치를 지정하세요.');
    if(pin){
      validatePin(pin);assert(pointInGreen(pin,geometry),'현재 홀의 GI Green 안에서 PIN을 지정하세요.');
      next.holePins=next.holePins||{};const old=next.holePins[String(h.hole)]||null;
      next.holePins[String(h.hole)]={...clone(pin),hole:h.hole,groupId:next.groupId,isSurveyed:false,
        geometryVersion:geometry.geometryVersion||null,holeId:geometry.holeId??null,confirmedAt:services.now(),
        editHistory:[...(old?.editHistory||[]),{at:services.now(),previous:old?{lat:old.lat,lng:old.lng,time:old.time,source:old.source}:null}]};
    }
    const confirmed={...clone(point),confirmedAt:services.now()};
    finishShotEnd(shot,confirmed,'ON_GREEN',services);
    shot.result.greenGeometry={courseId:geometry.courseId??null,holeId:geometry.holeId??null,version:geometry.geometryVersion||null,source:'GOLF_INTELLIGENCE'};
    if(p.round.pending?.id===shot.id)p.round.pending=null;
    p.ballPosition=clone(confirmed);p.shotDraft={...emptyShotDraft(h.hole),club:p.shotDraft.club};
    h.lessonStatus='AWAITING_PUTTING';h.puttingReady={status:'AWAITING_INPUT',entryShotId:shot.id,ballPosition:clone(confirmed),preparedAt:services.now(),firstPuttDistanceM:null};
    p.round.analysisSnapshot=null;next.updatedAt=services.now();return validateGroup(next);
  }
  function holed(group,playerId,shotId,services){
    const next=clone(validateGroup(group)),{p,h,shot}=resultShot(next,playerId,shotId);
    // Hole-out is a confirmed result, not a measured PIN/ball coordinate.
    finishShotEnd(shot,null,'HOLED',services);
    if(p.round.pending?.id===shot.id)p.round.pending=null;
    h.completed=true;h.completedAt=services.now();h.lessonStatus='HOLED';
    h.score=h.shots.length+(h.putts||0)+(h.penalties||0);h.puttingReady=null;
    p.shotDraft={...emptyShotDraft(h.hole),club:p.shotDraft.club};p.round.analysisSnapshot=null;
    next.updatedAt=services.now();return validateGroup(next);
  }
  function pendingResultShot(player){
    const r=player?.round,h=r?.holes[r.currentHole-1],shots=h?.shots||[],shot=shots[shots.length-1];
    return player?.registered&&h&&!h.completed&&h.lessonStatus!=='AWAITING_PUTTING'&&shot?.status==='PENDING_RESULT'?shot:null;
  }
  function resultTargetShot(player,shotId){
    if(!shotId)return pendingResultShot(player);
    const r=player?.round,h=r?.holes[r.currentHole-1],shot=h?.shots.find(s=>s.id===shotId);
    return player?.registered&&h&&!h.completed&&h.lessonStatus!=='AWAITING_PUTTING'&&
      (shot?.status==='PENDING_RESULT'||(shot?.status==='RESULT_CONFIRMED'&&shot.result?.type==='NEXT_SHOT_START'))?shot:null;
  }
  function puttDistance(raw){
    const value=Number(raw);
    const rounded=Math.round(value*10)/10;
    return raw.trim()!==''&&Number.isFinite(rounded)&&value>=0.1?rounded:null;
  }
  function puttingHole(group,playerId,hole){
    assert(group.selectedPlayerId===playerId,'선택 선수의 퍼팅만 입력할 수 있습니다.');
    const p=shotPlayer(group,playerId),h=p.round.holes[p.round.currentHole-1];
    assert(h.hole===hole&&!h.completed&&h.lessonStatus==='AWAITING_PUTTING'&&h.puttingReady?.status==='AWAITING_INPUT','현재 선수/홀의 PUTTING READY 상태를 확인하세요.');
    assert(h.puttsDetail.every(putt=>putt.strokeKind==='PUTT')&&(h.putts||0)===h.puttsDetail.length,'기존 퍼팅 기록과 충돌하여 저장을 차단합니다.');
    return {p,h};
  }
  function setPuttDistance(group,playerId,hole,raw,services){
    assert(typeof raw==='string'&&raw.length<=24,'퍼팅 거리 입력을 확인하세요.');
    const next=clone(validateGroup(group)),{h}=puttingHole(next,playerId,hole),ready=h.puttingReady;
    if(ready.distanceInput!==raw){ready.distanceInput=raw;ready.distanceM=puttDistance(raw);ready.inputId=ready.distanceM===null?null:id('clpd',services);}
    next.updatedAt=services.now();return validateGroup(next);
  }
  function recordPutt(group,playerId,hole,number,inputId,result,services){
    const next=clone(validateGroup(group)),{p,h}=puttingHole(next,playerId,hole),ready=h.puttingReady;
    assert(['HOLED','SHORT','LONG'].includes(result),'퍼팅 결과를 선택하세요.');
    assert(ready.distanceM>=0.1&&Number.isFinite(ready.distanceM)&&ready.inputId===inputId&&
      typeof inputId==='string'&&number===h.puttsDetail.length+1,'거리 입력이 없거나 이미 저장된 퍼팅입니다. 다음 실제 거리를 입력하세요.');
    assert(!p.round.holes.some(hole=>hole.puttsDetail.some(putt=>putt.inputId===inputId)),'이미 저장된 퍼팅 입력입니다.');
    h.puttsDetail.push({id:'clputt_'+inputId.slice(5),inputId,playerId:p.playerId,roundId:p.roundId,groupId:next.groupId,
      hole:h.hole,number,distanceM:ready.distanceM,result,strokeKind:'PUTT',physicalStroke:true,
      source:'SCORER_CONFIRMED',slope:null,break:null,sg:null,at:services.now()});
    h.putts=h.puttsDetail.length;h.firstPutt=h.puttsDetail[0].distanceM;ready.firstPuttDistanceM=h.firstPutt;
    ready.distanceInput='';ready.distanceM=null;ready.inputId=null;
    h.score=h.shots.length+h.putts+(h.penalties||0);p.round.analysisSnapshot=null;
    if(result==='HOLED'){h.completed=true;h.completedAt=services.now();h.lessonStatus='HOLED';ready.status='HOLED';}
    next.updatedAt=services.now();return validateGroup(next);
  }
  const terminalResult=shot=>['ON_GREEN','HOLED'].includes(shot?.result?.type);
  function cancellationContext(group,playerId,shotId,undo){
    assert(group.selectedPlayerId===playerId,'선택 선수의 기록만 취소할 수 있습니다.');
    const p=shotPlayer(group,playerId),r=p.round,h=r.holes[r.currentHole-1],shot=h.shots.find(s=>s.id===shotId);
    assert(shot?.physicalStroke===true&&['PENDING_RESULT','RESULT_CONFIRMED'].includes(shot.status),'현재 홀의 Physical Shot을 선택하세요.');
    if(undo)assert(h.shots.at(-1)?.id===shotId,'현재 홀의 마지막 Physical Shot만 취소할 수 있습니다.');
    else{
      assert(terminalResult(shot),'ON GREEN 또는 HOLED 결과를 선택하세요.');
      assert(h.shots.at(-1)?.id===shotId,'후속 Physical Shot이 있어 결과 취소를 차단합니다. 마지막 샷부터 확인하세요.');
    }
    const recorded=hole=>(hole.putts||0)>0||hole.puttsDetail.length>0||(hole.penalties||0)>0||hole.penaltyEvents.length>0||hole.puttingState!=null;
    assert(!recorded(h)&&h.puttingReady?.firstPuttDistanceM==null&&h.review==null,'퍼팅/패널티/리뷰 등 후속 기록이 있어 취소를 차단합니다. 후속 기록을 먼저 확인하세요.');
    assert(!r.holes.slice(r.currentHole).some(hole=>hole.shots.length||recorded(hole)),'다음 홀의 후속 기록이 있어 취소를 차단합니다.');
    assert(!(r.specialEvents||[]).some(e=>e.hole==null||Number(e.hole)===h.hole),'관련 후속 이벤트가 있어 취소를 차단합니다.');
    assert(!p.shotDraft.position&&!p.shotDraft.confirmed,'후속 볼 위치 입력이 있어 취소를 차단합니다. 입력을 먼저 확인하세요.');
    assert(h.shots.filter(terminalResult).length<=1,'여러 종료 결과가 충돌하여 취소를 차단합니다.');
    const terminal=h.shots.find(terminalResult);
    assert(!h.completed||terminal?.result.type==='HOLED','홀 완료 상태와 Shot 결과가 충돌하여 취소를 차단합니다.');
    assert(!h.puttingReady||h.puttingReady.entryShotId===terminal?.id,'Putting 준비 참조가 충돌하여 취소를 차단합니다.');
    return {p,r,h,shot};
  }
  function restoreEnd(shot,index,type,services){
    const history=shot.editHistory,entry=history?.[index],before=entry?.previous;
    assert(before&&['PENDING_RESULT','RESULT_CONFIRMED'].includes(before.status),'이전 End 복구 이력이 없어 취소를 차단합니다.');
    const {editHistory,...current}=shot;
    if(before.id===shot.id){
      for(const key of Object.keys(shot))if(key!=='editHistory')delete shot[key];
      Object.assign(shot,clone(before));
    }else{
      // Phase 3B records saved before complete snapshots: recover only recorded facts.
      assert(before.status==='PENDING_RESULT'||before.result?.type==='NEXT_SHOT_START','기존 결과의 복구 이력을 확인할 수 없어 취소를 차단합니다.');
      Object.assign(shot,clone(before));
      if(before.status==='PENDING_RESULT')delete shot.endState;
      shot.holed=false;shot.positionSource.end=before.end?.source||null;
      shot.distanceM=before.end?services.distance(shot.start,before.end):null;
      shot.courseContext.endGreenDistanceM=null;shot.sg=null;
      shot.updatedAt=history[index-1]?.at??shot.createdAt;
      const original=history.slice(0,index).find(e=>e.next?.end)?.next.end;
      if(original)shot.originalEnd=clone(original);else delete shot.originalEnd;
    }
    history.push({at:services.now(),type,source:'SCORER_CONFIRMATION',previous:clone(current),
      next:{end:clone(shot.end),endLie:shot.endLie,endState:shot.endState||null}});
  }
  function recoverHole(p,h){
    const terminal=h.shots.find(terminalResult),pending=h.shots.findLast(s=>s.status==='PENDING_RESULT');
    h.completed=terminal?.result.type==='HOLED';
    if(!h.completed){delete h.completedAt;delete h.score;}
    else h.score=h.shots.length+(h.putts||0)+(h.penalties||0);
    h.lessonStatus=terminal?.result.type==='HOLED'?'HOLED':terminal?'AWAITING_PUTTING':'IN_PROGRESS';
    if(!terminal)h.puttingReady=null;
    if(p.round.pending?.hole===h.hole||!p.round.pending)p.round.pending=pending?{
      id:pending.id,hole:h.hole,shotSequence:pending.shotSequence,status:'PENDING_RESULT',result:null}:null;
    const last=h.shots.at(-1);
    p.ballPosition=terminal?.end?clone(terminal.end):last?clone(last.end||last.start):null;
    p.shotDraft={...emptyShotDraft(h.hole),club:p.shotDraft.club};
    p.round.analysisSnapshot=null;p.round.completedAt=null;
    const remaining=p.round.holes.flatMap(hole=>hole.shots);
    p.round.lessonRoundStatus=remaining.length?'IN_PROGRESS':'REGISTERED';
    p.round.startedAt=remaining.length?Math.min(...remaining.map(s=>s.startedAt??s.createdAt)):null;
    if(!h.shots.length)delete h.startedAt;
  }
  function cancelResult(group,playerId,shotId,services){
    const next=clone(validateGroup(group)),{p,h,shot}=cancellationContext(next,playerId,shotId,false);
    const index=shot.editHistory.length-1;
    const end=shot.editHistory[index]?.next;
    assert(end?.endState===shot.endState&&end.endLie===shot.endLie&&JSON.stringify(end.end)===JSON.stringify(shot.end),'결과 복구 이력이 일치하지 않아 취소를 차단합니다.');
    restoreEnd(shot,index,'RESULT_CANCELLED',services);recoverHole(p,h);
    next.updatedAt=services.now();return validateGroup(next);
  }
  function undoLastShot(group,playerId,shotId,services){
    const next=clone(validateGroup(group)),{p,h,shot}=cancellationContext(next,playerId,shotId,true),previous=h.shots.at(-2);
    assert(shot.previousShotId||previous?.result?.nextShotId!==shot.id,'자동 연결 참조가 손상되어 취소를 차단합니다.');
    if(shot.previousShotId){
      assert(previous?.id===shot.previousShotId,'직전 Shot 연결이 일치하지 않아 취소를 차단합니다.');
      if(previous.result?.type==='NEXT_SHOT_START'){
        assert(previous.result.nextShotId===shot.id&&previous.result.confirmationId===shot.confirmationId,'직전 End 연결이 변경되어 취소를 차단합니다.');
        let index=previous.editHistory.findLastIndex(e=>e.next?.endState==='POSITION_CONFIRMED');
        while(index>=0&&previous.editHistory[index].previous?.result?.type==='NEXT_SHOT_START'){
          index=previous.editHistory.findLastIndex((e,i)=>i<index&&e.next?.endState==='POSITION_CONFIRMED');
        }
        assert(previous.editHistory[index]?.previous?.status==='PENDING_RESULT','자동 연결 전 End 이력이 없어 취소를 차단합니다.');
        restoreEnd(previous,index,'SHOT_LINK_UNDONE',services);
      }else assert(terminalResult(previous),'직전 End 복구 상태를 확인할 수 없어 취소를 차단합니다.');
    }
    h.shots.pop();recoverHole(p,h);
    next.updatedAt=services.now();return validateGroup(next);
  }
  const api={STORAGE,developmentAllowed,createGroup,updateDraft,selectPlayer,registerPlayer,validateGroup,saveGroup,restoreGroup,
    setShotClub,chooseHole,stagePosition,confirmPosition,recordShot,greenGeometry,pointInGreen,onGreen,holed,pendingResultShot,resultTargetShot,cancelResult,undoLastShot,setPuttDistance,recordPutt};
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
      distance:(a,b)=>window.hav(a,b),
      greenGeometry:(r,hole)=>{
        const data=window.activeCourseData(r),h=data?.holes?.[String(hole)];
        return {hole,holeId:h?.i??h?.id??null,courseId:data?.courseId??null,geometryVersion:data?.version||r.courseVersion||null,
          polygons:window.courseShapes(h,r).filter(shape=>shape.type==='GREEN'&&!shape.line&&shape.path.length>=3).map(shape=>shape.path)};
      },
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
      <div class="lessonNotice">개발 테스트 전용 · 가상 선수만 사용하세요. 인증/실서비스가 아닙니다.<br>이름: TEST 선수 A · 전화/WhatsApp: TEST-WA-001 또는 TEST-TEL-001. 실제 개인정보 입력 금지.<br>Group은 이 브라우저에만 임시 저장됩니다. Penalty·SG 종합 검증·DB/Guest Claim·자동 폐기는 아직 제공하지 않습니다.</div>
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
        <div id="lessonPendingResult" class="lessonBench" role="group" aria-labelledby="lessonPendingResultLabel" hidden>
          <strong id="lessonPendingResultLabel"></strong><div class="lessonActions">
            <button type="button" id="lessonOnGreen" data-lesson-result="ON_GREEN" disabled>ON GREEN · 확대 Green</button>
            <button type="button" id="lessonHoled" data-lesson-result="HOLED" disabled>HOLED · Hole Out</button>
          </div>
        </div>
        <p class="lessonMeta">실제로 친 샷을 한 번만 저장하세요. 같은 선수의 다음 시작 위치를 확인하면 직전 Shot의 End로 연결합니다. 과거 누락 위치는 추정하지 않습니다. SG는 아직 미계산입니다.</p>
        <div id="lessonHoleState" class="lessonMeta" role="status"></div>
        <section id="lessonPutting" class="lessonBench" hidden aria-labelledby="lessonPuttTitle">
          <h2 id="lessonPuttTitle">PUTTING READY</h2><p id="lessonPuttMeta" class="lessonMeta" aria-live="polite"></p>
          <div id="lessonPuttInputPanel"><p class="lessonMeta">PIN 기준 거리 선택 · 실제 거리를 직접 입력하거나 보정하세요. 공유 PIN 없이도 입력할 수 있습니다.</p>
            <button type="button" id="lessonPuttRangeToggle" class="puttRangeToggle">5m+</button>
            <div id="lessonPuttDistancePicker"></div><p id="lessonPuttScaleLabel" class="lessonMeta"></p>
            <div id="lessonPuttDistanceRow"></div>
            <div class="lessonPuttResults"><button type="button" id="lessonPuttHoled" disabled>HOLED</button><button type="button" id="lessonPuttShort" disabled>SHORT</button><button type="button" id="lessonPuttLong" disabled>LONG</button></div>
          </div><div id="lessonPuttHistory" class="lessonMeta" aria-live="polite"></div>
        </section>
        <div class="lessonBench"><strong id="lessonCancelTarget"></strong><div class="lessonActions">
          <button type="button" id="lessonUndoShot" disabled>UNDO LAST SHOT</button>
          <button type="button" id="lessonCancelResult" disabled>RESULT CANCEL · 결과만 취소</button>
        </div><p class="lessonMeta" id="lessonCancelInfo">샷 취소는 마지막 Physical Shot 1개만 제거합니다. 결과 취소는 Shot을 유지합니다. 공유 PIN은 보존합니다.</p></div>
        <div id="lessonShotHistory" class="lessonShotHistory" aria-live="polite"></div></section>
      <dialog id="lessonGreenDialog" class="lessonGreenDialog" aria-labelledby="lessonGreenTitle">
        <div class="lessonGreenHeader"><h2 id="lessonGreenTitle">Green Detail</h2><button type="button" id="lessonGreenCancel">취소</button></div>
        <p id="lessonGreenMapInfo" class="lessonMeta"></p>
        <div class="lessonGreenMap"><div id="lessonGreenSatellite" hidden></div><svg id="lessonGreenSvg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet" aria-label="확대 GI Green · 볼 또는 PIN 위치를 탭하세요"></svg></div>
        <div class="lessonActions"><button type="button" id="lessonGreenBall">볼 위치 지정</button><button type="button" id="lessonGreenPin">PIN 지정 · 선택 사항</button><button type="button" id="lessonGreenSkipPin">PIN 건너뛰기</button></div>
        <p id="lessonGreenPinInfo" class="lessonMeta"></p><p id="lessonGreenStatus" class="lessonMeta" role="status" aria-live="polite">Green 안에서 볼 위치를 탭하세요.</p>
        <button type="button" id="lessonGreenSave" disabled>볼 위치 확인 · ON GREEN 저장</button>
      </dialog>
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
    const el=id=>host.querySelector('#'+id);let group=null,selectedResult=null;
    const selectedShot=p=>{
      const h=p?.round?.holes[p.round.currentHole-1];
      return selectedResult?.groupId===group?.groupId&&selectedResult.playerId===p?.playerId&&
        selectedResult.hole===p?.round?.currentHole?h?.shots.find(s=>s.id===selectedResult.shotId):h?.shots.at(-1);
    };
    const status=(message,error=false)=>{el('lessonStatus').textContent=message;el('lessonStatus').dataset.error=String(error);};
    const readDraft=()=>({name:el('lessonName').value,contact:el('lessonContact').value,sex:el('lessonSex').value,handicap:el('lessonHandicap').value,tee:el('lessonTee').value});
    const currentInput=()=>updateDraft(group,group.selectedPlayerId,readDraft());
    // Reuse Player's distance controls and PIN scale without its global Round/draft handlers.
    const greenPicker=document.getElementById('puttGreen').cloneNode(true);
    const distanceRow=document.getElementById('puttDistanceInput').closest('.puttDistanceRow').cloneNode(true);
    for(const root of [greenPicker,distanceRow]){
      for(const node of [root,...root.querySelectorAll('[id]')])if(node.id)node.id='lesson'+node.id[0].toUpperCase()+node.id.slice(1);
      for(const node of root.querySelectorAll('[clip-path]'))node.setAttribute('clip-path','url(#lessonPuttGreenClip)');
    }
    greenPicker.setAttribute('aria-label','PIN 기준 퍼팅 거리 선택 · 실제 거리를 입력하세요.');
    el('lessonPuttDistancePicker').append(greenPicker);el('lessonPuttDistanceRow').append(distanceRow);
    el('lessonPuttDistanceInput').setAttribute('inputmode','decimal');
    let puttRangeLong=false;
    // PIN-relative diagram selections only; never save these as GPS/Raw Shot positions.
    const puttMarkers=new Map();
    const puttMarkerKey=(p,h)=>JSON.stringify([group.groupId,p.playerId,p.roundId,h.hole,
      h.puttingReady.entryShotId,h.puttingReady.preparedAt,h.puttsDetail.length+1]);
    function renderPutting(){
      const p=group?.players.find(p=>p.playerId===group.selectedPlayerId),h=p?.round?.holes[p.round.currentHole-1],ready=h?.puttingReady;
      el('lessonPutting').hidden=!ready;if(!ready)return;
      const number=h.puttsDetail.length+1,ordinal=number===1?'1st':number===2?'2nd':number===3?'3rd':number+'th';
      el('lessonPuttTitle').textContent=p.profile.name+' · '+h.hole+'번 홀 · '+(h.completed?'HOLE OUT':ordinal+' PUTT');
      el('lessonPuttMeta').textContent=(h.completed?'HOLE OUT':'PUTTING READY')+' · Putts '+h.puttsDetail.length+' · Score '+(h.shots.length+h.putts+(h.penalties||0))+' · 마지막 결과 '+(h.puttsDetail.at(-1)?.result||'없음')+' · SG 미계산';
      el('lessonPuttInputPanel').hidden=h.completed;
      el('lessonPuttDistanceInput').value=ready.distanceInput||'';
      const rings=puttRangeLong?[5,10,15,20]:[0.5,1,2,3,5],max=puttRangeLong?20:5;
      const marker=puttMarkers.get(puttMarkerKey(p,h)),scale=marker?marker.rangeM/max:1;
      const ball=marker?{x:180+(marker.x-180)*scale,y:180+(marker.y-180)*scale}:null;
      const visible=!h.completed&&ball&&Math.hypot(ball.x-180,ball.y-180)<=140;
      el('lessonPuttBall').setAttribute('visibility',visible?'visible':'hidden');
      el('lessonPuttLine').setAttribute('visibility',visible?'visible':'hidden');
      if(ball){
        el('lessonPuttBall').setAttribute('cx',ball.x);el('lessonPuttBall').setAttribute('cy',ball.y);
        for(const [key,value] of [['x1',180],['y1',180],['x2',ball.x],['y2',ball.y]])el('lessonPuttLine').setAttribute(key,value);
      }
      el('lessonPuttRings').innerHTML=rings.map(m=>'<circle cx="180" cy="180" r="'+(140*m/max)+'" fill="none" stroke="#8cc6ad" stroke-dasharray="4 5"/><text x="180" y="'+(195-140*m/max)+'" text-anchor="middle">'+m+'m</text>').join('');
      el('lessonPuttScaleLabel').textContent='PIN 기준 · '+rings.join('m / ')+'m';
      el('lessonPuttRangeToggle').textContent=puttRangeLong?'0–5m':'5m+';
      el('lessonPuttHistory').replaceChildren();
      h.puttsDetail.forEach(putt=>{const row=document.createElement('div');row.textContent=putt.number+' PUTT · '+putt.distanceM.toFixed(1)+'m · '+putt.result+' · SG 미계산';el('lessonPuttHistory').append(row);});
      for(const [button,result] of [['lessonPuttHoled','HOLED'],['lessonPuttShort','SHORT'],['lessonPuttLong','LONG']]){
        el(button).disabled=h.completed||ready.distanceM==null;
        const token=ready.inputId,playerId=p.playerId,hole=h.hole,groupId=group.groupId;
        el(button).onclick=()=>{
          try{assert(group?.groupId===groupId,'Group이 변경됐습니다. 다시 입력하세요.');
            commit(recordPutt(currentInput(),playerId,hole,number,token,result,services),result==='HOLED'?'선택 선수 HOLE OUT · 다른 선수는 계속 입력할 수 있습니다.':'퍼팅 1회 저장 · 다음 실제 거리를 입력하세요.');
          }catch(e){status('퍼팅 저장 차단: '+e.message,true);}
        };
      }
    }
    function savePuttDistance(raw){
      try{
        const p=group.players.find(p=>p.playerId===group.selectedPlayerId);
        const next=setPuttDistance(currentInput(),p.playerId,p.round.currentHole,raw,services);
        saveGroup(localStorage,next);group=next;renderPutting();status('퍼팅 거리 입력 저장 · 타수는 증가하지 않습니다.');
      }catch(e){for(const key of ['lessonPuttHoled','lessonPuttShort','lessonPuttLong'])el(key).disabled=true;status('거리 저장 실패: '+e.message,true);}
    }
    el('lessonPuttDistanceInput').addEventListener('input',()=>savePuttDistance(el('lessonPuttDistanceInput').value));
    el('lessonPuttDistanceInput').addEventListener('change',()=>{
      const value=puttDistance(el('lessonPuttDistanceInput').value);
      savePuttDistance(value===null?'':value.toFixed(1));
    });
    for(const [key,delta] of [['lessonPuttMinus',-0.1],['lessonPuttPlus',0.1]])el(key).onclick=()=>{
      const value=Number(el('lessonPuttDistanceInput').value)||0;
      savePuttDistance(Math.max(0.1,Math.round((value+delta)*10)/10).toFixed(1));
    };
    el('lessonPuttRangeToggle').onclick=()=>{puttRangeLong=!puttRangeLong;renderPutting();};
    greenPicker.addEventListener('click',event=>{
      const ctm=greenPicker.getScreenCTM();if(!ctm)return;
      const point=greenPicker.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const q=point.matrixTransform(ctm.inverse()),radius=Math.hypot(q.x-180,q.y-180);
      if(radius<=140){
        const p=group?.players.find(p=>p.playerId===group.selectedPlayerId),h=p?.round?.holes[p.round.currentHole-1];
        if(!h?.puttingReady||h.completed)return;
        puttMarkers.set(puttMarkerKey(p,h),{x:q.x,y:q.y,rangeM:puttRangeLong?20:5});
        savePuttDistance(Math.max(0.1,Math.round(radius*(puttRangeLong?20:5)/140*10)/10).toFixed(1));
      }
    });
    for(let i=1;i<=18;i++){const option=document.createElement('option');option.value=String(i);option.textContent=i+'번 홀';el('lessonHole').append(option);}
    services.clubs.forEach(club=>{const option=document.createElement('option');option.value=club;option.textContent=club;el('lessonShotClub').append(option);});
    mapController=window.JGICourseLessonMapController(host,()=>group,point=>{
      try{commit(stagePosition(currentInput(),group.selectedPlayerId,point),'Map Touch 위치 후보 저장 · 볼 위치를 확인하세요.');}catch(e){status(e.message,true);}
    },{
      geometry:(r,hole)=>greenGeometry(r,hole,services),contains:pointInGreen,
      onSave:(context,point,pin)=>{
        assert(group?.groupId===context.groupId&&group.selectedPlayerId===context.playerId&&group.players.find(p=>p.playerId===context.playerId)?.round?.currentHole===context.hole,'선수/Group/홀이 변경됐습니다. Popup을 다시 여세요.');
        commit(onGreen(currentInput(),context.playerId,context.shotId,point,pin,services),'ON GREEN 저장 · 추가 Shot 없음 · 1st PUTT 실제 거리를 입력하세요.');
      }
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
      renderPutting();
      el('lessonEditor').hidden=!group;el('lessonPlayers').replaceChildren();
      el('lessonPendingResult').hidden=true;el('lessonOnGreen').disabled=true;el('lessonHoled').disabled=true;
      el('lessonUndoShot').disabled=true;el('lessonCancelResult').disabled=true;
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
        const current=player.round?.holes[player.round.currentHole-1];
        details.textContent=player.registered?String.fromCharCode(65+i)+' · '+player.round.sgBenchmarkLabel+' · '+player.profile.tee+' · Shot '+shots.length+' / Pending '+shots.filter(s=>s.status==='PENDING_RESULT').length+' · '+current.hole+'번 홀 · Putts '+current.putts+(current.completed?' · HOLE OUT':current.puttingReady?' · 다음 PUTT '+(current.puttsDetail.length+1):''):'선수 정보를 입력하세요.';
        button.append(name,details);button.addEventListener('click',()=>{
          try{const next=selectPlayer(updateDraft(group,group.selectedPlayerId,readDraft()),player.playerId);commit(next,'선수 전환 완료 · 입력 상태 유지');}catch(e){status(e.message,true);}
        });el('lessonPlayers').append(button);
      });
      const p=group.players.find(p=>p.playerId===group.selectedPlayerId);
      if(selectedResult&&(selectedResult.groupId!==group.groupId||selectedResult.playerId!==p.playerId||
        selectedResult.hole!==p.round?.currentHole||!p.round?.holes[p.round.currentHole-1].shots.some(s=>s.id===selectedResult.shotId)))selectedResult=null;
      el('lessonPlayerTitle').textContent='선수 '+(group.players.indexOf(p)+1)+' · '+(p.registered?'등록됨':'미등록');
      for(const [field,key] of [['lessonName','name'],['lessonContact','contact'],['lessonSex','sex'],['lessonHandicap','handicap'],['lessonTee','tee']])el(field).value=p.draft[key];
      el('lessonRoundMeta').textContent='Player ID: '+p.playerId+' · Round ID: '+p.roundId+' · '+(p.round?'독립 Round · '+p.round.lessonRoundStatus:'선수 등록 후 독립 Round 준비');
      previewBenchmark();
      el('lessonShotPanel').hidden=!p.registered;
      if(p.registered){
        const draft=p.shotDraft||emptyShotDraft(p.round.currentHole),letter=String.fromCharCode(65+group.players.indexOf(p));
        const h=p.round.holes[p.round.currentHole-1],blocked=h.completed||h.lessonStatus==='AWAITING_PUTTING';
        el('lessonShotPlayer').textContent=letter+' · '+p.profile.name+' · 샷 기록';
        el('lessonHole').value=String(p.round.currentHole);el('lessonShotClub').value=draft.club;
        el('lessonConfirmPosition').disabled=blocked||!draft.position||draft.confirmed;el('lessonShotSave').disabled=blocked||!draft.confirmed;
        el('lessonShotClub').disabled=blocked;el('lessonGetGps').disabled=blocked;
        const pending=selectedShot(p);
        if(pending&&resultTargetShot(p,pending.id)){
          el('lessonPendingResult').hidden=false;el('lessonOnGreen').disabled=false;el('lessonHoled').disabled=false;
          el('lessonPendingResultLabel').textContent=letter+' · '+p.profile.name+' · '+h.hole+'번 홀 · 선택된 Shot '+pending.shotSequence+' ('+pending.club+') · 결과 선택';
        }
        el('lessonHoleState').textContent=h.completed?'HOLED · 이 선수의 '+h.hole+'번 홀 완료 · Score '+h.score+' · Putts '+h.putts+' · 다음 홀은 직접 선택하세요.':h.lessonStatus==='AWAITING_PUTTING'?'ON GREEN · PUTTING READY · 실제 퍼팅 거리와 결과를 입력하세요.':'';
        const last=h.shots.at(-1),target=letter+' · '+p.profile.name+' · '+h.hole+'번 홀';
        el('lessonCancelTarget').textContent=target+' · 마지막 Shot '+(last?.shotSequence||'없음')+' · 선택 Shot '+(pending?.shotSequence||'없음');
        el('lessonCancelInfo').textContent='샷 취소: 마지막 Shot만 제거 · 결과 취소: 선택 Shot 유지 · 공유 PIN 보존';
        if(last){try{cancellationContext(clone(group),p.playerId,last.id,true);el('lessonUndoShot').disabled=false;}catch(e){el('lessonCancelInfo').textContent='UNDO 차단: '+e.message;}}
        if(terminalResult(pending)){try{cancellationContext(clone(group),p.playerId,pending.id,false);el('lessonCancelResult').disabled=false;}catch(e){el('lessonCancelInfo').textContent+=' · RESULT CANCEL 차단: '+e.message;}}
        el('lessonPosition').textContent=draft.position?(draft.confirmed?'확인됨':'미확인 후보')+' · '+draft.position.lat.toFixed(6)+', '+draft.position.lng.toFixed(6)+' · '+(draft.position.source==='GPS'?'GPS ±'+draft.position.accuracy+'m':'MAP TOUCH · GPS 정확도 없음'):'볼 위치 후보를 지정하세요.';
        el('lessonShotHistory').replaceChildren();
        h.shots.forEach(shot=>{
          const row=document.createElement('button');row.type='button';
          row.disabled=!['PENDING_RESULT','RESULT_CONFIRMED'].includes(shot.status);row.setAttribute('aria-pressed',String(pending?.id===shot.id));
          const label=shot.status==='PENDING_RESULT'?'PENDING RESULT':shot.result?.type==='NEXT_SHOT_START'?'End 연결 · 다음 시작 위치':shot.result?.type||'기존 기록';
          row.textContent='Shot '+shot.shotSequence+' · '+shot.club+' · '+(shot.start?.source==='GPS'?'GPS':'MAP TOUCH')+' · '+label+' · SG 미계산';
          row.addEventListener('click',()=>{
            selectedResult={groupId:group.groupId,playerId:p.playerId,hole:h.hole,shotId:shot.id};
            render();status('Shot '+shot.shotSequence+' 선택 · 결과 입력 또는 저장된 결과 취소');
          });
          el('lessonShotHistory').append(row);
        });
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
    for(const [button,undo] of [['lessonUndoShot',true],['lessonCancelResult',false]])el(button).addEventListener('click',()=>{
      try{
        const p=group?.players.find(p=>p.playerId===group.selectedPlayerId),h=p?.round?.holes[p.round.currentHole-1],shot=undo?h?.shots.at(-1):selectedShot(p);
        assert(shot,'취소할 Shot이 없습니다.');
        cancellationContext(clone(group),p.playerId,shot.id,undo);
        const next=(undo?undoLastShot:cancelResult)(currentInput(),p.playerId,shot.id,services);
        if(!confirm(p.profile.name+' · '+h.hole+'번 홀 · Shot '+shot.shotSequence+' ('+shot.club+') · '+
          (undo?'마지막 Physical Shot과 결과를 취소할까요?':'ON GREEN / HOLED 결과만 취소할까요? Physical Shot은 유지합니다.')))return;
        mapController.closeGreen();selectedResult=null;
        commit(next,undo?'마지막 Shot 취소 완료 · 직전 End 복구 · 다른 선수/공유 PIN 보존':'결과 취소 완료 · Physical Shot 유지 · 홀 상태 복구');
      }catch(e){status('취소 차단: '+e.message,true);}
    });
    el('lessonOnGreen').addEventListener('click',()=>{
      try{
        const p=group?.players.find(p=>p.playerId===group.selectedPlayerId),shot=selectedShot(p);
        assert(shot,'선택 선수의 현재 홀에서 결과를 확정할 저장 Shot을 선택하세요.');
        mapController.openGreen({groupId:group.groupId,playerId:p.playerId,hole:p.round.currentHole,shotId:shot.id});
      }catch(e){status(e.message,true);}
    });
    el('lessonHoled').addEventListener('click',()=>{
      try{
        const p=group?.players.find(p=>p.playerId===group.selectedPlayerId),shot=selectedShot(p);
        assert(shot,'선택 선수의 현재 홀에서 결과를 확정할 저장 Shot을 선택하세요.');
        if(!confirm(p.profile.name+' · '+p.round.currentHole+'번 홀 · Shot '+shot.shotSequence+'가 홀인했나요? 추가 타수 없이 이 선수의 홀만 완료합니다.'))return;
        commit(holed(currentInput(),p.playerId,shot.id,services),'HOLED 저장 · 추가 Shot/Putting 없음 · 선택 선수만 Hole 완료');
      }catch(e){status(e.message,true);}
    });
    el('lessonGetGps').addEventListener('click',()=>{
      if(!navigator.geolocation){status('이 브라우저는 GPS를 지원하지 않습니다. Map Touch를 사용하세요.',true);return;}
      const playerId=group.selectedPlayerId,groupId=group.groupId,requestedHole=group.players.find(p=>p.playerId===playerId).round.currentHole;
      const restoreGpsButton=()=>{
        const r=group?.players.find(p=>p.playerId===group.selectedPlayerId)?.round,h=r?.holes[r.currentHole-1];
        el('lessonGetGps').disabled=!h||h.completed||h.lessonStatus==='AWAITING_PUTTING';
      };
      el('lessonGetGps').disabled=true;status('기록원 GPS를 가져오는 중 · 볼 위치는 자동 확정하지 않습니다.');
      navigator.geolocation.getCurrentPosition(position=>{
        restoreGpsButton();
        try{assert(group?.groupId===groupId&&group.players.find(p=>p.playerId===playerId)?.round?.currentHole===requestedHole,'GPS 요청 후 Group/홀이 변경됐습니다. 다시 위치를 가져오세요.');
          const point={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,time:position.timestamp,source:'GPS'};
          commit(stagePosition(currentInput(),playerId,point),'요청한 선수의 GPS 후보 저장 · 기록원이 볼 위치를 확인하세요.');
        }catch(e){status('GPS 후보 저장 실패: '+e.message,true);}
      },error=>{restoreGpsButton();status((error.code===1?'GPS 권한이 필요합니다.':'GPS 위치를 가져오지 못했습니다.')+' Map Touch를 사용할 수 있습니다.',true);},
      {enableHighAccuracy:true,maximumAge:0,timeout:15000});
    });
    restore();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else boot();
})();
