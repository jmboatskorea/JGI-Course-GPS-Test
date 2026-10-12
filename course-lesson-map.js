/* Uses the existing course geometry and existing Google Map; never creates a Map. */
(function(){
  'use strict';
  if(!window.JGI_COURSE_LESSON_MAP)return;
  window.JGICourseLessonMapController=function(host,getGroup,onCandidate){
    const el=id=>host.querySelector('#'+id),svg=el('lessonCourseSvg');
    const colors=['#ffb648','#67d7ff','#dc9cff','#70ef9f'];
    let map=null,available=false,mode='JGI',projector=null,candidateMarker=null;
    const markers=new Map();
    const style={HOLE_BOUNDARY:['#102319','#31583e'],FAIRWAY:['#24643c','#3d9a5d'],GREEN:['#38e77b','#8affb0'],BUNKER:['#cdbb85','#ecdca9'],WATER:['#184f78','#3389bd'],WATER_PATH:['none','#3389bd'],TEE:['#365f43','#77a781']};
    function render(){
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
    const controller={render,attach:instance=>{
      if(map===instance)return;map=instance;available=true;
      el('lessonSatelliteMap').append(document.getElementById('googleMap'));
      map.addListener('click',event=>onCandidate({lat:event.latLng.lat(),lng:event.latLng.lng(),accuracy:null,time:Date.now(),source:'MANUAL_DROP',inputMethod:'MAP_TOUCH'}));render();
    },unavailable:message=>{available=false;mode='JGI';el('lessonMapStatus').textContent=message;render();}};
    return controller;
  };
})();
