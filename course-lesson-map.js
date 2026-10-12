/* Uses the existing course geometry and existing Google Map; never creates a Map. */
(function(){
  'use strict';
  if(!window.JGI_COURSE_LESSON_MAP)return;
  window.JGICourseLessonMapController=function(host,getGroup,onCandidate,options){
    const el=id=>host.querySelector('#'+id),svg=el('lessonCourseSvg');
    const colors=['#ffb648','#67d7ff','#dc9cff','#70ef9f'];
    let map=null,available=false,mode='JGI',projector=null,candidateMarker=null;
    const dialog=el('lessonGreenDialog'),greenSvg=el('lessonGreenSvg');
    let green=null,greenBallMarker=null,pinMarker=null,greenOverlays=[];
    const markers=new Map();
    const style={HOLE_BOUNDARY:['#102319','#31583e'],FAIRWAY:['#24643c','#3d9a5d'],GREEN:['#38e77b','#8affb0'],BUNKER:['#cdbb85','#ecdca9'],WATER:['#184f78','#3389bd'],WATER_PATH:['none','#3389bd'],TEE:['#365f43','#77a781']};
    function render(){
      if(green){renderGreen();return;}
      const group=getGroup(),selected=group?.players.find(p=>p.playerId===group.selectedPlayerId),r=selected?.round;
      svg.hidden=mode!=='JGI';el('lessonSatelliteMap').hidden=mode!=='SAT';el('lessonSatellite').disabled=!available;
      svg.replaceChildren();el('lessonMarkerLegend').textContent='';
      if(!r){projector=null;markers.forEach(marker=>marker.setMap(null));candidateMarker?.setMap(null);return;}
      const data=window.activeCourseData(r),h=data?.holes?.[String(r.currentHole)];
      const positions=group.players.map(p=>p.ballPosition).filter(Boolean);
      if(selected.shotDraft?.position)positions.push(selected.shotDraft.position);
      projector=window.courseViewProjector(h,r,positions);
      if(!projector){el('lessonMapStatus').textContent='코스 도형이 없습니다. GPS 후보를 확인할 수 있습니다.';return;}
      const node=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
      const order={HOLE_BOUNDARY:0,WATER:1,WATER_PATH:2,FAIRWAY:3,BUNKER:4,TEE:5,GREEN:6};
      projector.shapes.slice().sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)).forEach(shape=>{
        if(!shape.path.length)return;const [fill,stroke]=style[shape.type]||['none','#89978f'];
        const path=shape.line?shape.path.map((p,i)=>{const q=projector.project(p);return (i?'L':'M')+q.x+','+q.y;}).join(' '):window.svgPath(shape.path,projector.project);
        node('path',{d:path,fill,stroke,'stroke-width':1.5});
      });
      const bounds=available?new google.maps.LatLngBounds():null;
      if(h?.t)bounds?.extend({lat:h.t[0],lng:h.t[1]});if(h?.g)bounds?.extend({lat:h.g[0],lng:h.g[1]});
      const validIds=new Set(),legend=[];
      const projected=group.players.map(p=>p.ballPosition?projector.project(p.ballPosition):null);
      group.players.forEach((player,i)=>{
        const letter=String.fromCharCode(65+i),point=player.ballPosition;
        legend.push(letter+' · '+(player.profile?.name||'미등록')+' · '+(point?(point.source==='GPS'?'GPS':'MAP TOUCH'):'볼 위치 미지정'));
        if(!player.registered||!point)return;
        const q=projector.project(point);
        const overlap=projected.some((other,j)=>j!==i&&other&&Math.hypot(q.x-other.x,q.y-other.y)<24);
        const label={x:q.x+(overlap?(i%2?16:-16):0),y:q.y+(overlap?(i<2?-18:18):0)};
        if(q.inside){
          if(overlap){node('line',{x1:q.x,y1:q.y,x2:label.x,y2:label.y,stroke:colors[i],'stroke-width':1.5});node('circle',{cx:q.x,cy:q.y,r:3,fill:colors[i]});}
          node('circle',{cx:label.x,cy:label.y,r:player.playerId===group.selectedPlayerId?12:9,fill:colors[i],stroke:'#fff','stroke-width':2,'data-player-marker':player.playerId,'data-position-player':player.playerId});
          node('text',{x:label.x,y:label.y+4,'text-anchor':'middle',fill:'#08131b','font-size':12,'font-weight':900,'data-position-player':player.playerId},letter);
        }
        else legend[legend.length-1]+=' (현재 홀 화면 밖)';
        if(available){
          validIds.add(player.playerId);bounds.extend(point);
          let marker=markers.get(player.playerId);
          if(!marker){marker=new google.maps.Marker({map,position:point,title:letter+' · '+player.profile.name,clickable:false});markers.set(player.playerId,marker);}
          marker.setMap(map);marker.setPosition(point);marker.setLabel({text:letter,color:'#08131b',fontWeight:'900'});
          marker.setZIndex(player.playerId===group.selectedPlayerId?200:100+i);
          marker.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:player.playerId===group.selectedPlayerId?12:9,fillColor:colors[i],fillOpacity:1,strokeColor:'#fff',strokeWeight:2});
        }
      });
      markers.forEach((marker,id)=>{if(!validIds.has(id)){marker.setMap(null);markers.delete(id);}});
      const draft=selected.shotDraft;
      if(draft?.position&&!draft.confirmed){
        const q=projector.project(draft.position);if(q.inside)node('circle',{cx:q.x,cy:q.y,r:13,fill:'none',stroke:'#fff','stroke-width':2,'stroke-dasharray':'4 3','data-position-candidate':'true'});
        if(available){if(!candidateMarker)candidateMarker=new google.maps.Marker({map,position:draft.position,title:'미확인 볼 위치 후보'});candidateMarker.setPosition(draft.position);candidateMarker.setMap(map);bounds.extend(draft.position);}
      }else candidateMarker?.setMap(null);
      el('lessonMarkerLegend').textContent=legend.join(' / ');
      if(available&&mode==='SAT'){google.maps.event.trigger(map,'resize');map.fitBounds(bounds,30);}
    }
    svg.addEventListener('click',event=>{
      if(!projector)return;const ctm=svg.getScreenCTM();if(!ctm)return;
      const marked=event.target.closest('[data-position-player]');
      if(marked){const point=getGroup()?.players.find(p=>p.playerId===marked.dataset.positionPlayer)?.ballPosition;
        if(point)onCandidate({...point,accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});return;}
      const screen=svg.createSVGPoint();screen.x=event.clientX;screen.y=event.clientY;
      const q=screen.matrixTransform(ctm.inverse());if(q.x<0||q.x>400||q.y<0||q.y>700)return;
      onCandidate({...projector.unproject(q),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'});
    });
    el('lessonJgiMap').addEventListener('click',()=>{mode='JGI';el('lessonMapStatus').textContent='JGI 코스 지도 · 선택 선수의 볼 위치를 탭하세요.';render();});
    el('lessonSatellite').addEventListener('click',()=>{if(!available)return;mode='SAT';el('lessonMapStatus').textContent='공통 위성 지도 · 선택 선수의 볼 위치를 탭하세요.';render();});
    el('lessonMapStatus').textContent='JGI 코스 지도 · 선택 선수의 볼 위치를 탭하세요.';
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
      greenSvg.hidden=available;el('lessonGreenSatellite').hidden=!available;
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
      if(!green)return;green=null;
      greenOverlays.forEach(overlay=>overlay.setMap(null));greenOverlays=[];greenBallMarker?.setMap(null);pinMarker?.setMap(null);
      if(map)el('lessonSatelliteMap').append(document.getElementById('googleMap'));
      document.body.classList.remove('lesson-green-open');if(dialog.open)dialog.close();render();
    }
    function openGreen(context){
      const group=getGroup(),p=group?.players.find(p=>p.playerId===context.playerId),h=p?.round?.holes?.[context.hole-1];
      if(green)throw new Error('현재 Green Popup을 먼저 닫으세요.');
      if(group?.groupId!==context.groupId||group.selectedPlayerId!==context.playerId||p?.round?.currentHole!==context.hole||h?.shots.at(-1)?.id!==context.shotId||h.shots.at(-1).status!=='PENDING_RESULT')throw new Error('선택 선수의 현재 Pending Shot을 확인하세요.');
      const geometry=options.geometry(p.round,context.hole);
      green={context:{...context},geometry,projector:greenProjector(geometry),ball:null,pin:null,input:'BALL'};
      el('lessonGreenTitle').textContent=p.profile.name+' · '+context.hole+'번 홀 · Shot '+h.shots.at(-1).shotSequence+' · ON GREEN';
      el('lessonGreenStatus').textContent='확대 Green 안에서 볼 위치를 탭하세요. PIN은 건너뛸 수 있습니다.';
      dialog.showModal();document.body.classList.add('lesson-green-open');mountGreenMap();renderGreen();
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
      if(map===instance)return;map=instance;available=true;
      el('lessonSatelliteMap').append(document.getElementById('googleMap'));
      map.addListener('click',event=>{const point={lat:event.latLng.lat(),lng:event.latLng.lng(),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'};if(green)greenCandidate(point);else onCandidate(point);});
      if(green)mountGreenMap();render();
    },openGreen,closeGreen,unavailable:message=>{available=false;mode='JGI';el('lessonMapStatus').textContent=message;render();}};
    return controller;
  };
})();
