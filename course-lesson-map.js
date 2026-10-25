/* Uses the existing course geometry and existing Google Map; never creates a Map. */
(function(){
  'use strict';
  if(!window.JGI_COURSE_LESSON_MAP)return;
  const coordinate=value=>Array.isArray(value)&&value.length>=2&&value.every(Number.isFinite)&&Math.abs(value[0])<85.051129&&Math.abs(value[1])<=180?{lat:value[0],lng:value[1]}:null;
  function bearing(tee,green){
    const a=tee.lat*Math.PI/180,b=green.lat*Math.PI/180,d=(green.lng-tee.lng)*Math.PI/180;
    return (Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))*180/Math.PI+360)%360;
  }
  function alignment(h,r){
    const tee=coordinate(h?.t),green=coordinate(h?.g);
    const warning='GI 공통 Tee → Green';
    if(!tee||!green)return {tee,green,warning:!tee?'GI Tee GPS 없음 · 자동 정렬 불가':'GI Green Center GPS 없음 · 자동 정렬 불가',heading:null};
    if(Math.abs(tee.lat-green.lat)+Math.abs(tee.lng-green.lng)<1e-9)return {tee,green,warning:'Tee / Green 동일 좌표 · 자동 정렬 불가',heading:null};
    return {tee,green,heading:bearing(tee,green),warning};
  }
  const world=p=>({x:(p.lng+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))/Math.PI)/2});
  const geographic=p=>({lat:Math.atan(Math.sinh(Math.PI*(1-2*p.y)))*180/Math.PI,lng:((p.x*360)%360+360)%360-180});
  function camera(points,heading,width,height,padding=30){
    if(!points.length||width<=padding*2||height<=padding*2)return null;
    const anchor=world(points[0]),angle=heading*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const rotated=points.map(p=>{const q=world(p),dx=((q.x-anchor.x+.5)%1+1)%1-.5,dy=q.y-anchor.y;return {x:dx*c+dy*s,y:-dx*s+dy*c};});
    const minX=Math.min(...rotated.map(p=>p.x)),maxX=Math.max(...rotated.map(p=>p.x)),minY=Math.min(...rotated.map(p=>p.y)),maxY=Math.max(...rotated.map(p=>p.y));
    const x=(minX+maxX)/2,y=(minY+maxY)/2;
    const zoom=Math.min(21,Math.max(1,Math.log2(Math.min((width-padding*2)/(256*Math.max(maxX-minX,1e-12)),(height-padding*2)/(256*Math.max(maxY-minY,1e-12))))));
    return {center:geographic({x:anchor.x+x*c-y*s,y:anchor.y+x*s+y*c}),zoom,heading,tilt:0};
  }
  function fitPoints(h,r){
    const shapes=window.courseShapes(h,r),anchors=[coordinate(h?.t),coordinate(h?.g)].filter(Boolean);
    // ROUND fits the selected boundary and Tee/Green. Include its actual fairway/green/tees too.
    const core=anchors.concat(shapes.filter(s=>['HOLE_BOUNDARY','FAIRWAY','GREEN','TEE'].includes(s.type)).flatMap(s=>s.path||[]));
    if(!core.length)return [];
    const local=window.courseLocalProjector(core[0]),direction=anchors.length===2?local.toXY(anchors[1]):{x:0,y:1};
    const angle=Math.atan2(direction.x,direction.y),c=Math.cos(angle),s=Math.sin(angle);
    // Clip nearby hazards in the same Tee→Green frame as ROUND, including diagonal holes.
    const toXY=p=>{const q=local.toXY(p);return {x:q.x*c-q.y*s,y:q.x*s+q.y*c};};
    const toLatLng=q=>local.toLatLng({x:q.x*c+q.y*s,y:-q.x*s+q.y*c});
    const xy=core.map(toXY);
    const box={minX:Math.min(...xy.map(p=>p.x))-30,maxX:Math.max(...xy.map(p=>p.x))+30,minY:Math.min(...xy.map(p=>p.y))-30,maxY:Math.max(...xy.map(p=>p.y))+30};
    const clipped=[];
    for(const shape of shapes.filter(s=>['BUNKER','WATER','WATER_PATH'].includes(s.type))){
      let polygon=shape.path.map(toXY);
      if(shape.line){
        for(let i=1;i<polygon.length;i++){
          const a=polygon[i-1],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y;let low=0,high=1,valid=true;
          for(const [p,q] of [[-dx,a.x-box.minX],[dx,box.maxX-a.x],[-dy,a.y-box.minY],[dy,box.maxY-a.y]]){
            if(p===0){if(q<0){valid=false;break;}}
            else if(p<0)low=Math.max(low,q/p);else high=Math.min(high,q/p);
          }
          if(valid&&low<=high)clipped.push(toLatLng({x:a.x+low*dx,y:a.y+low*dy}),toLatLng({x:a.x+high*dx,y:a.y+high*dy}));
        }
        continue;
      }
      // Only the near-hole part affects fitting; original hazard GPS paths remain unchanged.
      for(const [axis,limit,lower] of [['x',box.minX,true],['x',box.maxX,false],['y',box.minY,true],['y',box.maxY,false]]){
        const input=polygon;polygon=[];if(!input.length)break;
        for(let i=0;i<input.length;i++){
          const a=input[i],b=input[(i+1)%input.length],inside=p=>lower?p[axis]>=limit:p[axis]<=limit;
          if(inside(a))polygon.push(a);
          if(inside(a)!==inside(b)){const t=(limit-a[axis])/(b[axis]-a[axis]);polygon.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
        }
      }
      clipped.push(...polygon.map(toLatLng));
    }
    return core.concat(clipped);
  }
  function svgFrame(project,points,width,height){
    if(!points.length||width<=0||height<=0)return null;
    const q=points.map(project),xs=q.map(p=>p.x),ys=q.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const pad=Math.min(16,width*.05,height*.08),scale=Math.min((width-2*pad)/Math.max(right-left,1e-9),(height-2*pad)/Math.max(bottom-top,1e-9));
    const w=width/scale,h=height/scale;
    return [(left+right-w)/2,(top+bottom-h)/2,w,h].join(' ');
  }
  window.JGICourseLessonMapAlignment=Object.freeze({alignment,bearing,camera,fitPoints,svgFrame});
  window.JGICourseLessonMapController=function(host,getGroup,onCandidate,options){
    const el=id=>host.querySelector('#'+id),svg=el('lessonCourseSvg');
    const colors=['#ffb648','#67d7ff','#dc9cff','#70ef9f'];
    let map=null,available=false,mode='JGI',projector=null,candidateMarker=null,mapFailure=null,mapClickListener=null,renderRevision=0;
    const dialog=el('lessonGreenDialog'),greenSvg=el('lessonGreenSvg');
    let green=null,greenBallMarker=null,pinMarker=null,greenOverlays=[];
    const markers=new Map();
    let viewKey=null,appliedKey=null,viewPoints=[],viewAlignment=null,rotationIssue='',mapListeners=[],restoreCamera=null,verifyPending=false,userCamera=false,interactionCleanup=null,baseStatus='',svgAutoBox=null,svgManual=false,svgSize='',satSize='',fittedCamera=null;
    function showMapStatus(message){
      const node=el('lessonMapStatus');node.textContent=message;
      node.setAttribute?.('data-error',String(!!mapFailure||/실패|오류|없|불가|미지원|RASTER/.test(message)));
    }
    const angleError=(a,b)=>Math.abs(((a-b+540)%360)-180);
    function markManual(){
      userCamera=true;
      if(verifyPending){rotationIssue='수동 지도 유지';showMapStatus(baseStatus+' · '+rotationIssue);}
      verifyPending=false;
    }
    const readCamera=()=>{const center=map?.getCenter?.(),zoom=map?.getZoom?.(),heading=map?.getHeading?.(),tilt=map?.getTilt?.();return center&&Number.isFinite(zoom)?{center:{lat:typeof center.lat==='function'?center.lat():center.lat,lng:typeof center.lng==='function'?center.lng():center.lng},zoom,...(Number.isFinite(heading)?{heading}:{}),...(Number.isFinite(tilt)?{tilt}:{})}:null;};
    function cameraChanged(){
      const current=readCamera();if(!current||!fittedCamera)return false;
      return Math.abs(current.center.lat-fittedCamera.center.lat)>1e-7||Math.abs(current.center.lng-fittedCamera.center.lng)>1e-7||
        Math.abs(current.zoom-fittedCamera.zoom)>1e-4||angleError(current.heading||0,fittedCamera.heading||0)>0.01||Math.abs((current.tilt||0)-(fittedCamera.tilt||0))>0.01;
    }
    function writeCamera(value){
      if(map.moveCamera)map.moveCamera(value);else{map.setCenter?.(value.center);map.setZoom?.(value.zoom);if(Number.isFinite(value.heading))map.setHeading?.(value.heading);if(Number.isFinite(value.tilt))map.setTilt?.(value.tilt);}
    }
    function verifyHeading(final=false){
      if(verifyPending&&!green&&mode==='SAT'&&appliedKey===viewKey&&viewAlignment?.heading!=null&&map?.getRenderingType?.()==='VECTOR'){
        const actual=map.getHeading?.();
        if(Number.isFinite(actual)&&angleError(actual,viewAlignment.heading)<1){rotationIssue='';verifyPending=false;}
        else if(final){rotationIssue='Satellite 회전 적용 확인 실패';verifyPending=false;}
      }
    }
    function applyView(revision){
      const instance=map,key=viewKey;
      requestAnimationFrame(()=>{
        if(revision!==renderRevision||instance!==map||!available||mode!=='SAT'||green||key!==viewKey)return;
        google.maps.event.trigger(map,'resize');if(map.getMapTypeId?.()!=='satellite')map.setMapTypeId?.('satellite');
        if(restoreCamera){
          verifyPending=false;try{writeCamera(restoreCamera);fittedCamera=readCamera();}catch{rotationIssue='Satellite 카메라 복원 실패';showMapStatus(baseStatus+' · '+rotationIssue);diagnostic?.record('camera.RESTORE_FAILED');}
          restoreCamera=null;diagnose();return;
        }
        const type=map.getRenderingType?.(),rotates=viewAlignment?.heading!=null&&type==='VECTOR'&&typeof map.getHeading==='function'&&(typeof map.moveCamera==='function'||typeof map.setHeading==='function');
        const rect=el('lessonSatelliteMap').getBoundingClientRect?.();
        if(rect&&(!rect.width||!rect.height)){rotationIssue='Satellite 화면 크기 확인 대기';return;}
        const size=rect?Math.round(rect.width)+':'+Math.round(rect.height):'';
        if(appliedKey===key&&!userCamera&&cameraChanged())markManual();
        if(appliedKey===key&&(satSize===size||userCamera))return;
        const previousIssue=rotationIssue;
        const value=rect?camera(viewPoints,rotates?viewAlignment.heading:0,rect.width,rect.height,Math.min(24,rect.width/10,rect.height/10)):null;
        verifyPending=rotates;
        try{
          if(value&&(map.moveCamera||(map.setCenter&&map.setZoom)))writeCamera(value);
          else{const bounds=new google.maps.LatLngBounds();viewPoints.forEach(p=>bounds.extend(p));map.fitBounds(bounds,30);}
        }catch{appliedKey=key;satSize=size;verifyPending=false;rotationIssue='Satellite 카메라 적용 실패';showMapStatus(baseStatus+' · '+rotationIssue);diagnostic?.record('camera.APPLY_FAILED');return;}
        fittedCamera=readCamera();appliedKey=key;satSize=size;rotationIssue=viewAlignment?.heading==null?'자동 정렬 불가':rotates?(previousIssue==='Satellite 회전 적용 확인 실패'?previousIssue:'Satellite 회전 확인 대기'):type==='RASTER'?'Satellite RASTER · 임의 각도 회전 미지원':'Satellite 회전 지원 확인 불가';
        verifyHeading();diagnose();
        showMapStatus(baseStatus+(rotationIssue?' · '+rotationIssue:''));
      });
    }
    const style={HOLE_BOUNDARY:['#102319','#31583e'],FAIRWAY:['#24643c','#3d9a5d'],GREEN:['#38e77b','#8affb0'],BUNKER:['#cdbb85','#ecdca9'],WATER:['#184f78','#3389bd'],WATER_PATH:['none','#3389bd'],TEE:['#365f43','#77a781']};
    function inFrame(point){
      const frame=svg.getAttribute?.('viewBox')?.trim().split(/\s+/).map(Number);
      return frame?.length===4&&frame.every(Number.isFinite)?point.x>=frame[0]&&point.x<=frame[0]+frame[2]&&point.y>=frame[1]&&point.y<=frame[1]+frame[3]:point.inside;
    }
    function holePosition(player,hole){
      if(!player?.registered||player.round?.currentHole!==hole)return null;
      const h=player.round.holes[hole-1],draft=player.shotDraft,last=h?.shots.at(-1);
      return draft?.hole===hole&&draft.confirmed?draft.position:h?.puttingReady?.ballPosition||last?.end||last?.start||null;
    }
    const diagnostic=window.JGI_COURSE_LESSON_DIAGNOSTICS;
    function diagnose(reason){diagnostic?.state(mode,reason,!!map);}
    function render(){
      diagnose();
      const revision=++renderRevision;
      const group=getGroup(),selected=group?.players.find(p=>p.playerId===group.selectedPlayerId),r=selected?.round;
      if(green){
        if(group?.groupId===green.context.groupId&&selected?.playerId===green.context.playerId&&r?.currentHole===green.context.hole)renderGreen();
        else closeGreen();return;
      }
      svg.toggleAttribute('hidden',mode!=='JGI');el('lessonSatelliteMap').hidden=mode!=='SAT';el('lessonSatellite').disabled=!available;diagnose();
      el('lessonSatellite').setAttribute('title',available?'Google Satellite':mapFailure||'Google Maps 초기화 완료를 기다리고 있습니다.');
      svg.replaceChildren();el('lessonMarkerLegend').textContent='';projector=null;
      markers.forEach(marker=>marker.setMap(null));candidateMarker?.setMap(null);
      svg.setAttribute('data-hole',r?.currentHole||'');svg.setAttribute('data-hole-id','');
      if(!r)return;
      const hole=r.currentHole,data=window.activeCourseData(r),h=data?.holes?.[String(hole)];
      const points=group.players.map(p=>holePosition(p,hole));
      const draft=selected.shotDraft;
      const nextKey=JSON.stringify([group.groupId,r.course,r.nine,data?.version||null,hole,h?.t,h?.g]);
      const resetView=nextKey!==viewKey;
      if(svgAutoBox&&svg.getAttribute?.('viewBox')!==svgAutoBox)svgManual=true;
      if(resetView){viewKey=nextKey;appliedKey=null;rotationIssue='';restoreCamera=null;verifyPending=false;userCamera=false;fittedCamera=null;svgAutoBox=null;svgManual=false;svgSize='';satSize='';svg.setAttribute('viewBox','0 0 400 700');}
      viewAlignment=alignment(h,r);
      // Ball/candidate updates never change the hole's orientation or fitting bounds.
      if(h)projector=window.courseViewProjector(viewAlignment.heading==null?{...h,t:undefined,g:undefined}:h,r,[]);
      viewPoints=h?fitPoints(h,r):[];
      svg.setAttribute('data-alignment-bearing',viewAlignment.heading??'');svg.setAttribute('data-tee-reference','COMMON_GI');
      if(!projector||!projector.shapes.some(shape=>shape.path.length>=3)){
        projector=null;mode='JGI';svg.toggleAttribute('hidden',false);el('lessonSatelliteMap').hidden=true;el('lessonSatellite').disabled=true;
        diagnostic?.record('missing.GI');diagnose('MISSING_GI');
        showMapStatus(hole+'번 홀 GI 지도 데이터가 없습니다.');return;
      }
      svg.setAttribute('data-hole-id',h.i??h.id??'');
      const rect=host.querySelector('.lessonMapHost')?.getBoundingClientRect?.()||svg.getBoundingClientRect?.()||{width:400,height:700};
      const size=Math.round(rect.width)+':'+Math.round(rect.height);
      if(!svgManual&&(resetView||size!==svgSize||!svgAutoBox)){
        const frame=svgFrame(projector.project,viewPoints,rect.width,rect.height);
        if(frame){svg.setAttribute('viewBox',frame);svgAutoBox=frame;svgSize=size;}
      }
      baseStatus=(mapFailure?mapFailure+' · ':'')+hole+'번 홀 · '+viewAlignment.warning;
      showMapStatus(baseStatus+(mode==='SAT'&&rotationIssue?' · '+rotationIssue:''));
      const node=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
      const order={HOLE_BOUNDARY:0,WATER:1,WATER_PATH:2,FAIRWAY:3,BUNKER:4,TEE:5,GREEN:6};
      projector.shapes.slice().sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)).forEach(shape=>{
        if(!shape.path.length)return;const [fill,stroke]=style[shape.type]||['none','#89978f'];
        const path=shape.line?shape.path.map((p,i)=>{const q=projector.project(p);return (i?'L':'M')+q.x+','+q.y;}).join(' '):window.svgPath(shape.path,projector.project);
        node('path',{d:path,fill,stroke,'stroke-width':1.5,'data-course-shape':shape.type,'data-hole':hole});
      });
      const validIds=new Set(),legend=[];
      const projected=points.map(point=>point?projector.project(point):null);
      group.players.forEach((player,i)=>{
        const letter=String.fromCharCode(65+i),point=points[i];
        legend.push(letter+' · '+(player.profile?.name||'미등록')+' · '+(point?(point.source==='GPS'?'GPS':'MAP TOUCH'):'볼 위치 미지정'));
        if(!player.registered||!point)return;
        const q=projector.project(point);
        const overlap=projected.some((other,j)=>j!==i&&other&&Math.hypot(q.x-other.x,q.y-other.y)<24);
        const label={x:q.x+(overlap?(i%2?16:-16):0),y:q.y+(overlap?(i<2?-18:18):0)};
        if(inFrame(q)){
          if(overlap){node('line',{x1:q.x,y1:q.y,x2:label.x,y2:label.y,stroke:colors[i],'stroke-width':1.5});node('circle',{cx:q.x,cy:q.y,r:3,fill:colors[i]});}
          node('circle',{cx:label.x,cy:label.y,r:player.playerId===group.selectedPlayerId?12:9,fill:colors[i],stroke:'#fff','stroke-width':2,'data-player-marker':player.playerId,'data-position-player':player.playerId});
          node('text',{x:label.x,y:label.y+4,'text-anchor':'middle',fill:'#08131b','font-size':12,'font-weight':900,'data-position-player':player.playerId},letter);
        }
        else legend[legend.length-1]+=' (현재 홀 화면 밖)';
        if(available){
          validIds.add(player.playerId);
          let marker=markers.get(player.playerId);
          if(!marker){marker=new google.maps.Marker({map,position:point,title:letter+' · '+player.profile.name,clickable:false});markers.set(player.playerId,marker);}
          marker.setMap(map);marker.setPosition(point);marker.setLabel({text:letter,color:'#08131b',fontWeight:'900'});
          marker.setZIndex(player.playerId===group.selectedPlayerId?200:100+i);
          marker.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:player.playerId===group.selectedPlayerId?12:9,fillColor:colors[i],fillOpacity:1,strokeColor:'#fff',strokeWeight:2});
        }
      });
      markers.forEach((marker,id)=>{if(!validIds.has(id)){marker.setMap(null);markers.delete(id);}});
      if(draft?.hole===hole&&draft.position&&!draft.confirmed){
        const q=projector.project(draft.position);if(inFrame(q))node('circle',{cx:q.x,cy:q.y,r:13,fill:'none',stroke:'#fff','stroke-width':2,'stroke-dasharray':'4 3','data-position-candidate':'true'});
        if(available){if(!candidateMarker)candidateMarker=new google.maps.Marker({map,position:draft.position,title:'미확인 볼 위치 후보'});candidateMarker.setPosition(draft.position);candidateMarker.setMap(map);}
      }else candidateMarker?.setMap(null);
      el('lessonMarkerLegend').textContent=legend.join(' / ');
      if(available&&mode==='SAT')applyView(revision);
    }
    svg.addEventListener('click',event=>{
      if(!projector)return;const ctm=svg.getScreenCTM();if(!ctm)return;
      const marked=event.target.closest('[data-position-player]');
      if(marked){const group=getGroup(),r=group?.players.find(p=>p.playerId===group.selectedPlayerId)?.round;
        const point=holePosition(group?.players.find(p=>p.playerId===marked.dataset.positionPlayer),r?.currentHole);
        if(point)onCandidate({...point,accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});return;}
      const screen=svg.createSVGPoint();screen.x=event.clientX;screen.y=event.clientY;
      const q=screen.matrixTransform(ctm.inverse());if(!Number.isFinite(q.x)||!Number.isFinite(q.y))return;
      onCandidate({...projector.unproject(q),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
    });
    el('lessonJgiMap').addEventListener('click',()=>{mode='JGI';diagnostic?.record('mode.JGI');diagnose('USER_JGI');showMapStatus('JGI 코스 지도 · 선택 선수의 볼 위치를 탭하세요.');render();});
    el('lessonSatellite').addEventListener('click',()=>{if(!available)return;mode='SAT';diagnostic?.record('mode.SAT');showMapStatus('공통 위성 지도 · 선택 선수의 볼 위치를 탭하세요.');render();});
    showMapStatus('JGI 코스 지도 · 선택 선수의 볼 위치를 탭하세요.');
    function greenProjector(geometry){
      const points=geometry.polygons.flat(),local=window.courseLocalProjector(points[0]),xy=points.map(local.toXY);
      const minX=Math.min(...xy.map(p=>p.x)),maxX=Math.max(...xy.map(p=>p.x)),minY=Math.min(...xy.map(p=>p.y)),maxY=Math.max(...xy.map(p=>p.y));
      const scale=Math.min(336/Math.max(maxX-minX,1),436/Math.max(maxY-minY,1)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
      return {project:p=>{const q=local.toXY(p);return {x:200+(q.x-cx)*scale,y:250-(q.y-cy)*scale};},
        unproject:q=>local.toLatLng({x:cx+(q.x-200)/scale,y:cy-(q.y-250)/scale})};
    }
    function renderGreen(){
      if(!green)return;
      const savedPin=getGroup()?.holePins?.[String(green.context.hole)],pin=green.pin||savedPin;
      greenSvg.toggleAttribute('hidden',available);el('lessonGreenSatellite').hidden=!available;
      el('lessonGreenMapInfo').textContent=available?'Google Satellite + GI Green Polygon · 동일 지도 재사용':'위성 지도 연결 없음 · 현재 홀의 기존 GI Green Polygon만 표시';
      el('lessonGreenPinInfo').textContent=green.pin?'PIN 후보 · ON GREEN 저장 시 현재 홀의 Group에서 공유 · SCORER_MANUAL_MAP · 측량 좌표 아님':savedPin?'공유 PIN 있음 · 이 Group의 '+green.context.hole+'번 홀 · SCORER_MANUAL_MAP · 측량 좌표 아님':'PIN은 선택 사항입니다. 건너뛰어도 볼 위치를 저장할 수 있습니다.';
      el('lessonGreenPin').textContent=green.pin?'PIN 후보 다시 지정 · 선택 사항':savedPin?'공유 PIN 다시 지정 · 선택 사항':'PIN 지정 · 선택 사항';
      el('lessonGreenBall').setAttribute('aria-pressed',String(green.input==='BALL'));el('lessonGreenPin').setAttribute('aria-pressed',String(green.input==='PIN'));
      el('lessonGreenSave').disabled=!green.ball;
      greenSvg.replaceChildren();
      const node=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;greenSvg.append(n);return n;};
      green.geometry.polygons.forEach(polygon=>node('path',{d:window.svgPath(polygon,green.projector.project),fill:'#15452a',stroke:'#70ef9f','stroke-width':2,'data-green-polygon':'true'}));
      if(green.ball){const q=green.projector.project(green.ball);node('circle',{cx:q.x,cy:q.y,r:9,fill:'#fff',stroke:'#08131b','stroke-width':2,'data-green-ball':'true'});}
      if(pin){const q=green.projector.project(pin);node('text',{x:q.x,y:q.y,'text-anchor':'middle',fill:'#ffdc74','font-size':24,'data-green-pin':'true'},'⚑');}
      if(available){
        if(green.ball){
          if(!greenBallMarker)greenBallMarker=new google.maps.Marker({map,title:'선택 선수의 미확인 Green 볼 위치',clickable:false});
          greenBallMarker.setPosition(green.ball);greenBallMarker.setMap(map);greenBallMarker.setZIndex(250);
          greenBallMarker.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:'#ffffff',fillOpacity:1,strokeColor:'#08131b',strokeWeight:2});
        }else greenBallMarker?.setMap(null);
        if(pin){
          if(!pinMarker)pinMarker=new google.maps.Marker({map,title:'Group 공유 PIN · SCORER_MANUAL_MAP · 측량 아님',clickable:false});
          pinMarker.setPosition(pin);pinMarker.setMap(map);pinMarker.setLabel({text:'P',color:'#08131b',fontWeight:'900'});pinMarker.setZIndex(300);
          pinMarker.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#ffdc74',fillOpacity:1,strokeColor:'#08131b',strokeWeight:2});
        }else pinMarker?.setMap(null);
      }
    }
    function greenCandidate(point){
      if(!green)return;
      if(!options.contains(point,green.geometry)){el('lessonGreenStatus').textContent='현재 홀의 GI Green Polygon 안을 탭하세요. 이전 후보는 유지됩니다.';return;}
      if(green.input==='PIN')green.pin={...point,source:'SCORER_MANUAL_MAP'};else green.ball=point;
      el('lessonGreenStatus').textContent=(green.input==='PIN'?'PIN':'볼')+' 후보 · '+point.lat.toFixed(6)+', '+point.lng.toFixed(6)+' · 다시 탭하여 수정 가능 · 저장 전 미확정';
      renderGreen();
    }
    function mountGreenMap(){
      if(!green||!available)return;
      el('lessonGreenSatellite').append(document.getElementById('googleMap'));
      markers.forEach(marker=>marker.setMap(null));candidateMarker?.setMap(null);
      greenOverlays.forEach(overlay=>overlay.setMap(null));
      greenOverlays=green.geometry.polygons.map(paths=>new google.maps.Polygon({map,paths,clickable:false,strokeColor:'#70ef9f',strokeOpacity:1,strokeWeight:2,fillColor:'#70ef9f',fillOpacity:.08,zIndex:10}));
      const bounds=new google.maps.LatLngBounds();green.geometry.polygons.flat().forEach(point=>bounds.extend(point));
      const opened=green;
      requestAnimationFrame(()=>{if(green===opened&&available){google.maps.event.trigger(map,'resize');map.fitBounds(bounds,40);}});
    }
    function closeGreen(){
      if(!green)return;diagnostic?.record('Green.close');restoreCamera=green.map===map&&green.viewKey===viewKey?green.camera:null;green=null;
      greenOverlays.forEach(overlay=>overlay.setMap(null));greenOverlays=[];greenBallMarker?.setMap(null);pinMarker?.setMap(null);
      if(map)el('lessonSatelliteMap').append(document.getElementById('googleMap'));
      document.body.classList.remove('lesson-green-open');if(dialog.open)dialog.close();render();
    }
    function openGreen(context){
      const group=getGroup(),p=group?.players.find(p=>p.playerId===context.playerId),h=p?.round?.holes?.[context.hole-1];
      if(green)throw new Error('현재 Green Popup을 먼저 닫으세요.');
      const shot=h?.shots.find(s=>s.id===context.shotId);
      if(group?.groupId!==context.groupId||group.selectedPlayerId!==context.playerId||p?.round?.currentHole!==context.hole||h?.completed||h?.lessonStatus==='AWAITING_PUTTING'||
        !(shot?.status==='PENDING_RESULT'||(shot?.status==='RESULT_CONFIRMED'&&shot.result?.type==='NEXT_SHOT_START')))throw new Error('선택 선수의 현재 홀에 저장된 Shot을 확인하세요.');
      const geometry=options.geometry(p.round,context.hole);
      green={context:{...context},geometry,projector:greenProjector(geometry),ball:null,pin:null,input:'BALL',camera:appliedKey===viewKey?(restoreCamera||readCamera()):null,map,viewKey};
      el('lessonGreenTitle').textContent=p.profile.name+' · '+context.hole+'번 홀 · Shot '+shot.shotSequence+' · ON GREEN';
      el('lessonGreenStatus').textContent='확대 Green 안에서 볼 위치를 탭하세요. PIN은 건너뛸 수 있습니다.';
      verifyPending=false;fittedCamera=null;diagnostic?.record('Green.open');dialog.showModal();document.body.classList.add('lesson-green-open');mountGreenMap();renderGreen();
    }
    greenSvg.addEventListener('click',event=>{
      if(!green)return;const ctm=greenSvg.getScreenCTM();if(!ctm)return;
      const screen=greenSvg.createSVGPoint();screen.x=event.clientX;screen.y=event.clientY;const q=screen.matrixTransform(ctm.inverse());
      if(q.x<0||q.x>400||q.y<0||q.y>500)return;
      greenCandidate({...green.projector.unproject(q),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
    });
    el('lessonGreenBall').addEventListener('click',()=>{if(green){green.input='BALL';el('lessonGreenStatus').textContent='볼 위치를 탭하세요. 저장 전 다시 지정할 수 있습니다.';renderGreen();}});
    el('lessonGreenPin').addEventListener('click',()=>{if(green){green.input='PIN';el('lessonGreenStatus').textContent='PIN 위치를 탭하세요. 수동 참고 좌표이며 퍼팅 거리로 자동 사용하지 않습니다.';renderGreen();}});
    el('lessonGreenSkipPin').addEventListener('click',()=>{if(green){green.pin=null;green.input='BALL';el('lessonGreenStatus').textContent='새 PIN 입력을 건너뜁니다. 기존 공유 PIN은 유지하며 볼 위치만 저장할 수 있습니다.';renderGreen();}});
    el('lessonGreenCancel').addEventListener('click',closeGreen);dialog.addEventListener('cancel',event=>{event.preventDefault();closeGreen();});
    // A queued close event from the prior Popup must not close a rapid reopen.
    dialog.addEventListener('close',()=>{if(!dialog.open)closeGreen();});
    el('lessonGreenSave').addEventListener('click',()=>{try{if(!green?.ball)return;options.onSave(green.context,green.ball,green.pin);closeGreen();}catch(e){el('lessonGreenStatus').textContent='ON GREEN 저장 실패: '+e.message;}});
    const controller={render,attach:instance=>{
      const same=map===instance,mapElement=instance?.getDiv?.()||document.getElementById('googleMap');
      if(!instance||!mapElement){controller.unavailable('기존 Google Map 인스턴스/화면 연결을 확인하세요.');return;}
      diagnostic?.record('attach');map=instance;available=true;mapFailure=null;
      el('lessonSatelliteMap').append(mapElement);
      if(!same){
        appliedKey=null;restoreCamera=null;fittedCamera=null;mapListeners.forEach(listener=>listener?.remove?.());mapListeners=[];
        if(map.addListener){
          mapListeners.push(map.addListener('dragstart',()=>{if(!green)markManual();}));
          mapListeners.push(map.addListener('idle',()=>{if(!green&&!userCamera&&appliedKey===viewKey&&cameraChanged())markManual();const before=rotationIssue;verifyHeading(true);if(before!==rotationIssue&&!green)render();}));
          mapListeners.push(map.addListener('renderingtype_changed',()=>{
            if(green||mode!=='SAT')return;const type=map.getRenderingType?.();
            if(type!=='VECTOR'){rotationIssue=type==='RASTER'?'Satellite RASTER · 임의 각도 회전 미지원':'Satellite 회전 지원 확인 불가';render();}
            else if(rotationIssue==='Satellite 회전 지원 확인 불가'||rotationIssue==='Satellite RASTER · 임의 각도 회전 미지원'){
              if(userCamera)rotationIssue='자동 정렬 생략 · 수동 지도 유지';else appliedKey=null;render();
            }
          }));
        }
        interactionCleanup?.();
        const pointers=new Map(),events=['pointerdown','pointermove','pointerup','pointercancel','wheel','keydown'];
        const interaction=event=>{
          if(green)return;
          if(event.type==='wheel'||(event.type==='keydown'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','='].includes(event.key)))markManual();
          if(event.type==='pointerdown'){pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size>1||event.target.closest?.('button'))markManual();}
          const start=pointers.get(event.pointerId);if(event.type==='pointermove'&&start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>4)markManual();
          if(event.type==='pointerup'||event.type==='pointercancel')pointers.delete(event.pointerId);
        };
        for(const type of events)mapElement.addEventListener?.(type,interaction,{passive:true,capture:true});
        interactionCleanup=()=>{for(const type of events)mapElement.removeEventListener?.(type,interaction,true);};
        mapClickListener?.remove?.();
        mapClickListener=map.addListener('click',event=>{const point={lat:event.latLng.lat(),lng:event.latLng.lng(),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'};if(green)greenCandidate(point);else if(projector)onCandidate(point);});
      }
      if(green)mountGreenMap();render();
    },openGreen,closeGreen,unavailable:message=>{available=false;mode='JGI';mapFailure=message;
      const reason=message?.includes('인증 오류')?'AUTH_FAILURE':'LOAD_OR_CONNECTION';
      diagnostic?.record('unavailable.'+reason);diagnose(reason);render();}};
    return controller;
  };
})();
