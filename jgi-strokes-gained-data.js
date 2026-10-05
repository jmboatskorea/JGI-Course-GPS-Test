// JGI Strokes Gained Benchmark V1
// TOUR: Mark Broadie PGA TOUR ShotLink expected-strokes baseline (2003-2010, 8M+ shots).
// Handicap lenses: MODELED, not observed handicap-population expected-strokes tables.
// Model: a golfer with handicap H is represented as 72+H versus Tour baseline ~71.
// Extra strokes are split 65% long / 20% short / 15% putting and distributed across
// 14 long shots / 7 short-game shots / 30 putts.
// Units: off-green distance = yards; putting distance = feet.
window.JGI_SG_BENCHMARK_DATA={
  version:"JGI_SG_V1_2026-10-01",
  labels:{
    TOUR:"Tour",
    SCRATCH:"Scratch",
    HCP_5:"HCP 5",
    HCP_10:"HCP 10",
    HCP_15:"HCP 15",
    HCP_20:"HCP 20",
    HCP_25:"HCP 25"
  },
  levels:{
    TOUR:{handicap:null,type:"MEASURED"},
    SCRATCH:{handicap:0,type:"MODELED"},
    HCP_5:{handicap:5,type:"MODELED"},
    HCP_10:{handicap:10,type:"MODELED"},
    HCP_15:{handicap:15,type:"MODELED"},
    HCP_20:{handicap:20,type:"MODELED"},
    HCP_25:{handicap:25,type:"MODELED"}
  },
  model:{
    tourRoundScore:71,
    playerScoreBase:72,
    shares:{long:0.65,short:0.20,putting:0.15},
    shotsPerRound:{long:14,short:7,putting:30},
    longDefinition:"TEE or >100 yards",
    shortDefinition:"Off-green <=100 yards",
    note:"Tour is a measured published baseline. Scratch/HCP lenses are modeled comparison lenses."
  },
  sources:[
    {name:"Mark Broadie, Assessing Golfer Performance on the PGA TOUR, Table 9",role:"TOUR_OFF_GREEN",type:"MEASURED_PUBLISHED_BASELINE"},
    {name:"Published PGA TOUR expected-putts anchors",role:"TOUR_PUTTING",type:"MEASURED_PUBLISHED_BASELINE"},
    {name:"Published handicap gap model: 65% long / 20% short / 15% putting",role:"HANDICAP_MODEL",type:"MODELED"}
  ],
  offGreen:[
    {yards:10,fairway:2.18,rough:2.34,sand:2.43,recovery:3.45},
    {yards:20,fairway:2.40,rough:2.59,sand:2.53,recovery:3.51},
    {yards:30,fairway:2.52,rough:2.70,sand:2.66,recovery:3.57},
    {yards:40,fairway:2.60,rough:2.78,sand:2.82,recovery:3.71},
    {yards:50,fairway:2.66,rough:2.87,sand:2.92,recovery:3.79},
    {yards:60,fairway:2.70,rough:2.91,sand:3.15,recovery:3.83},
    {yards:70,fairway:2.72,rough:2.93,sand:3.21,recovery:3.84},
    {yards:80,fairway:2.75,rough:2.96,sand:3.24,recovery:3.84},
    {yards:90,fairway:2.77,rough:2.99,sand:3.24,recovery:3.82},
    {yards:100,tee:2.92,fairway:2.80,rough:3.02,sand:3.23,recovery:3.80},
    {yards:120,tee:2.99,fairway:2.85,rough:3.08,sand:3.21,recovery:3.78},
    {yards:140,tee:2.97,fairway:2.91,rough:3.15,sand:3.22,recovery:3.80},
    {yards:160,tee:2.99,fairway:2.98,rough:3.23,sand:3.28,recovery:3.81},
    {yards:180,tee:3.05,fairway:3.08,rough:3.31,sand:3.40,recovery:3.82},
    {yards:200,tee:3.12,fairway:3.19,rough:3.42,sand:3.55,recovery:3.87},
    {yards:220,tee:3.17,fairway:3.32,rough:3.53,sand:3.70,recovery:3.92},
    {yards:240,tee:3.25,fairway:3.45,rough:3.64,sand:3.84,recovery:3.97},
    {yards:260,tee:3.45,fairway:3.58,rough:3.74,sand:3.93,recovery:4.03},
    {yards:280,tee:3.65,fairway:3.69,rough:3.83,sand:4.00,recovery:4.10},
    {yards:300,tee:3.71,fairway:3.78,rough:3.90,sand:4.04,recovery:4.20},
    {yards:320,tee:3.79,fairway:3.84,rough:3.95,sand:4.12,recovery:4.31},
    {yards:340,tee:3.86,fairway:3.88,rough:4.02,sand:4.26,recovery:4.44},
    {yards:360,tee:3.92,fairway:3.95,rough:4.11,sand:4.41,recovery:4.56},
    {yards:380,tee:3.96,fairway:4.03,rough:4.21,sand:4.55,recovery:4.66},
    {yards:400,tee:3.99,fairway:4.11,rough:4.30,sand:4.69,recovery:4.75},
    {yards:420,tee:4.02,fairway:4.19,rough:4.40,sand:4.83,recovery:4.84},
    {yards:440,tee:4.08,fairway:4.27,rough:4.49,sand:4.97,recovery:4.94},
    {yards:460,tee:4.17,fairway:4.34,rough:4.58,sand:5.11,recovery:5.03},
    {yards:480,tee:4.28,fairway:4.42,rough:4.68,sand:5.25,recovery:5.13},
    {yards:500,tee:4.41,fairway:4.50,rough:4.77,sand:5.40,recovery:5.22},
    {yards:520,tee:4.54,fairway:4.58,rough:4.87,sand:5.54,recovery:5.32},
    {yards:540,tee:4.65,fairway:4.66,rough:4.96,sand:5.68,recovery:5.41},
    {yards:560,tee:4.74,fairway:4.74,rough:5.06,sand:5.82,recovery:5.51},
    {yards:580,tee:4.79,fairway:4.82,rough:5.15,sand:5.96,recovery:5.60},
    {yards:600,tee:4.82,fairway:4.89,rough:5.25,sand:6.10,recovery:5.70}
  ],
  putting:[
    {feet:1,expected:1.001},
    {feet:2,expected:1.009},
    {feet:3,expected:1.053},
    {feet:4,expected:1.147},
    {feet:5,expected:1.256},
    {feet:6,expected:1.357},
    {feet:7,expected:1.443},
    {feet:8,expected:1.515},
    {feet:9,expected:1.575},
    {feet:10,expected:1.626},
    {feet:15,expected:1.784},
    {feet:20,expected:1.878},
    {feet:25,expected:1.94},
    {feet:30,expected:1.984},
    {feet:40,expected:2.058},
    {feet:50,expected:2.135},
    {feet:60,expected:2.28},
    {feet:90,expected:2.40},
    {feet:100,expected:2.45}
  ]
};

/* Map-first on-course UI V2.
   Loaded from this existing script so index.html and all round data logic remain untouched. */
(function(){
  'use strict';

  var cssId='jgi-round-map-cockpit-v2-css';
  if(!document.getElementById(cssId)){
    var link=document.createElement('link');
    link.id=cssId;
    link.rel='stylesheet';
    link.href='round-map-cockpit-v2.css?v=20261006-1';
    document.head.appendChild(link);
  }

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else setTimeout(fn,0);
  }

  ready(function(){
    var roundScreen=document.getElementById('roundScreen');
    if(!roundScreen||document.getElementById('jgiMapUiV2'))return;

    var ui=document.createElement('div');
    ui.id='jgiMapUiV2';
    ui.className='jgi-map-ui-v2';
    ui.innerHTML='\
      <div class="jgi-map-topbar">\
        <button id="jgiShotPill" class="jgi-shot-pill" type="button"><span class="label">SHOT 1</span><span class="arrow">⌄</span></button>\
        <button id="jgiGpsPill" class="jgi-gps-pill" type="button"><span class="dot"></span><span class="label">GPS</span></button>\
      </div>\
      <div id="jgiMapDistance" class="jgi-map-distance hidden"><strong>—</strong><span>m</span></div>\
      <div id="jgiShotMenu" class="jgi-shot-menu hidden">\
        <button type="button" data-action="sat">위성 지도</button>\
        <button type="button" data-action="jgi">JGI 지도</button>\
        <button type="button" data-action="report">라운드 리포트</button>\
        <button type="button" data-action="end" class="danger">라운드 종료</button>\
      </div>\
      <div id="jgiHoleMenu" class="jgi-hole-menu hidden"></div>\
      <div class="jgi-map-cockpit">\
        <div class="jgi-cockpit-actions">\
          <button id="jgiPenaltyAction" class="penalty" type="button"><span class="icon">⚑</span>페널티 추가</button>\
          <button id="jgiCenterAction" type="button"><span class="icon">◎</span>중앙으로</button>\
          <button id="jgiDropAction" type="button"><span class="icon">◉</span>무벌타 드롭</button>\
        </div>\
        <div class="jgi-cockpit-main">\
          <button id="jgiHoleSummary" class="jgi-hole-summary" type="button"><strong>1번 홀</strong><span>Par — · —m</span></button>\
          <div class="jgi-club-carousel">\
            <button id="jgiClubPrev" class="jgi-club-arrow" type="button" aria-label="이전 클럽">‹</button>\
            <button id="jgiClubTrack" class="jgi-club-track" type="button" aria-label="클럽 전체 보기"><span class="left">3W</span><strong>DR</strong><span class="right">3I</span></button>\
            <button id="jgiClubNext" class="jgi-club-arrow" type="button" aria-label="다음 클럽">›</button>\
          </div>\
          <button id="jgiNextShot" class="jgi-next-shot" type="button">다음 샷으로 <span>›</span></button>\
        </div>\
        <div class="jgi-round-nav">\
          <button type="button" data-screen="round" class="sel"><b>⛳</b>라운드</button>\
          <button type="button" data-screen="overview"><b>▦</b>요약</button>\
          <button type="button" data-screen="performance"><b>◎</b>경기력</button>\
          <button type="button" data-screen="flo"><b>◉</b>멘탈</button>\
          <button type="button" data-screen="story"><b>✦</b>스토리</button>\
        </div>\
      </div>';
    roundScreen.appendChild(ui);

    var selectedClubIndex=0;
    var selectedByPlayer=false;
    var lastHoleNo=null;
    var greenMarker=null;
    var greenGuideLine=null;
    var greenIconUrl=null;
    var lastGreenKey='';

    function byId(id){return document.getElementById(id)}
    function safeCall(fn){try{return fn()}catch(e){return null}}

    function clubs(){
      var rows=[];
      try{
        rows=(Array.isArray(masterClubs)&&masterClubs.length?masterClubs:DEFAULT_MASTER_CLUBS)||[];
      }catch(e){rows=[]}
      return rows.filter(function(c){return c&&c.name});
    }

    function selectedClubName(){
      var rows=clubs();
      if(!rows.length)return 'DR';
      selectedClubIndex=((selectedClubIndex%rows.length)+rows.length)%rows.length;
      return rows[selectedClubIndex].name;
    }

    function setRecommendedClub(){
      if(selectedByPlayer)return;
      var name=null;
      try{
        var recs=recommendedClubs();
        if(recs&&recs[0])name=recs[0].name;
      }catch(e){}
      var rows=clubs();
      var index=rows.findIndex(function(c){return c.name===name});
      selectedClubIndex=index>=0?index:0;
    }

    function moveClub(delta){
      var rows=clubs();
      if(!rows.length)return;
      selectedByPlayer=true;
      selectedClubIndex=(selectedClubIndex+delta+rows.length)%rows.length;
      syncClub();
    }

    function syncClub(){
      var rows=clubs();
      var track=byId('jgiClubTrack');
      if(!track||!rows.length)return;
      var pending=null;
      try{pending=round&&round.pending?round.pending:null}catch(e){}
      if(pending&&pending.club){
        var pi=rows.findIndex(function(c){return c.name===pending.club});
        if(pi>=0)selectedClubIndex=pi;
      }
      selectedClubIndex=((selectedClubIndex%rows.length)+rows.length)%rows.length;
      var left=rows[(selectedClubIndex-1+rows.length)%rows.length].name;
      var current=rows[selectedClubIndex].name;
      var right=rows[(selectedClubIndex+1)%rows.length].name;
      track.querySelector('.left').textContent=left;
      track.querySelector('strong').textContent=current;
      track.querySelector('.right').textContent=right;
      track.classList.toggle('pending',!!pending);
      byId('jgiClubPrev').disabled=!!pending;
      byId('jgiClubNext').disabled=!!pending;
    }

    function syncTop(){
      var live=byId('liveScore');
      var shot=live&&live.textContent?live.textContent.trim():'SHOT 1';
      byId('jgiShotPill').querySelector('.label').textContent=shot||'SHOT 1';

      var gpsSource=byId('gpsTop');
      var gpsText=gpsSource&&gpsSource.textContent?gpsSource.textContent.trim():'GPS';
      var pill=byId('jgiGpsPill');
      pill.querySelector('.label').textContent=gpsText||'GPS';
      pill.classList.remove('warn','bad');
      try{
        if(!gps)pill.classList.add('bad');
        else if(Number(gps.accuracy)>15)pill.classList.add('warn');
      }catch(e){pill.classList.add('bad')}
    }

    function syncHole(){
      var title=byId('holeTitle');
      var meta=byId('holeParText');
      var summary=byId('jgiHoleSummary');
      if(!summary)return;
      summary.querySelector('strong').textContent=title&&title.textContent?title.textContent.trim():'1번 홀';
      var text=meta&&meta.textContent?meta.textContent.replace(/^\s*·\s*/,'').trim():'Par — · —m';
      summary.querySelector('span').textContent=text||'Par — · —m';

      var no=null;
      try{no=round?Number(round.currentHole):null}catch(e){}
      if(no&&no!==lastHoleNo){
        lastHoleNo=no;
        selectedByPlayer=false;
        setRecommendedClub();
        buildHoleMenu();
      }
    }

    function syncDistance(){
      var value=null;
      try{
        if(Number.isFinite(Number(targetDistanceM)))value=Number(targetDistanceM);
        else if(Number.isFinite(Number(greenDistanceM)))value=Number(greenDistanceM);
      }catch(e){}
      var box=byId('jgiMapDistance');
      if(!box)return;
      box.classList.toggle('hidden',!Number.isFinite(value));
      if(Number.isFinite(value)){
        box.querySelector('strong').textContent=Math.round(value);
        box.querySelector('span').textContent='m';
      }
    }

    function syncNext(){
      var btn=byId('jgiNextShot');
      var pending=null;
      try{pending=round&&round.pending?round.pending:null}catch(e){}
      btn.classList.toggle('pending',!!pending);
      btn.innerHTML=pending?'샷 완료 <span>›</span>':'다음 샷으로 <span>›</span>';
      byId('jgiDropAction').disabled=!!pending;
    }

    function buildHoleMenu(){
      var menu=byId('jgiHoleMenu');
      if(!menu)return;
      var current=0;
      try{current=round?Number(round.currentHole):0}catch(e){}
      menu.innerHTML='';
      for(var i=1;i<=18;i++){
        var b=document.createElement('button');
        b.type='button';
        b.textContent=String(i);
        b.dataset.hole=String(i);
        if(i===current)b.classList.add('sel');
        b.addEventListener('click',function(){
          var n=this.dataset.hole;
          var source=document.querySelector('#holebar [data-hole="'+n+'"]');
          if(source)source.click();
          menu.classList.add('hidden');
        });
        menu.appendChild(b);
      }
    }

    function greenIcon(){
      if(greenIconUrl)return greenIconUrl;
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">'+
        '<path d="M26 1C12.2 1 2 11.2 2 24.6 2 42 26 62 26 62s24-20 24-37.4C50 11.2 39.8 1 26 1z" fill="white" stroke="#dce8e1" stroke-width="2"/>'+
        '<path d="M21 38V17" stroke="#11b966" stroke-width="3.4" stroke-linecap="round"/>'+
        '<path d="M22.5 18h15l-5 5 5 5h-15z" fill="#11c972"/>'+
        '</svg>';
      greenIconUrl='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
      return greenIconUrl;
    }

    function updateGreenReference(){
      var active=document.body.classList.contains('round-active');
      var map=null,h=null;
      try{map=googleMap;h=round?courseHoleData():null}catch(e){}
      if(!active||!map||!window.google||!window.google.maps||!h||!h.g){
        if(greenMarker)greenMarker.setMap(null);
        if(greenGuideLine)greenGuideLine.setMap(null);
        return;
      }
      var pos={lat:Number(h.g[0]),lng:Number(h.g[1])};
      if(!Number.isFinite(pos.lat)||!Number.isFinite(pos.lng))return;
      var key=String(round.currentHole)+'|'+pos.lat+'|'+pos.lng;
      if(!greenMarker){
        greenMarker=new google.maps.Marker({
          map:map,
          position:pos,
          title:'Green reference',
          clickable:false,
          zIndex:56,
          icon:{url:greenIcon(),scaledSize:new google.maps.Size(46,57),anchor:new google.maps.Point(23,55)}
        });
      }else{
        greenMarker.setMap(map);
        if(key!==lastGreenKey)greenMarker.setPosition(pos);
      }
      lastGreenKey=key;

      var start=null,hasTarget=false;
      try{
        start=activeTargetStartReference();
        hasTarget=!!(targetMarker&&targetMarker.getMap&&targetMarker.getMap());
      }catch(e){}
      if(start&&!hasTarget){
        if(!greenGuideLine){
          greenGuideLine=new google.maps.Polyline({
            map:map,
            strokeColor:'#ffffff',
            strokeOpacity:0,
            strokeWeight:2,
            clickable:false,
            zIndex:35,
            icons:[{icon:{path:'M 0,-1 0,1',strokeColor:'#ffffff',strokeOpacity:.94,scale:2},offset:'0',repeat:'12px'}]
          });
        }
        greenGuideLine.setMap(map);
        greenGuideLine.setPath([start,pos]);
      }else if(greenGuideLine){
        greenGuideLine.setMap(null);
      }
    }

    function hideMenus(except){
      ['jgiShotMenu','jgiHoleMenu'].forEach(function(id){
        var el=byId(id);
        if(el&&id!==except)el.classList.add('hidden');
      });
    }

    byId('jgiShotPill').addEventListener('click',function(e){
      e.stopPropagation();
      var menu=byId('jgiShotMenu');
      hideMenus('jgiShotMenu');
      menu.classList.toggle('hidden');
    });
    byId('jgiGpsPill').addEventListener('click',function(){safeCall(function(){return startGPS()})});
    byId('jgiHoleSummary').addEventListener('click',function(e){
      e.stopPropagation();
      var menu=byId('jgiHoleMenu');
      hideMenus('jgiHoleMenu');
      buildHoleMenu();
      menu.classList.toggle('hidden');
    });
    byId('jgiShotMenu').addEventListener('click',function(e){
      var action=e.target.closest('button')&&e.target.closest('button').dataset.action;
      if(!action)return;
      if(action==='sat')document.querySelector('#mapViewToggle [data-map-view="SAT"]')?.click();
      if(action==='jgi')document.querySelector('#mapViewToggle [data-map-view="JGI"]')?.click();
      if(action==='report')byId('reportBtn')?.click();
      if(action==='end')byId('endRoundBtn')?.click();
      byId('jgiShotMenu').classList.add('hidden');
    });
    document.addEventListener('click',function(){hideMenus(null)});

    byId('jgiPenaltyAction').addEventListener('click',function(){byId('penaltyBtn')?.click()});
    byId('jgiCenterAction').addEventListener('click',function(){safeCall(function(){return recenterMap()})});
    byId('jgiDropAction').addEventListener('click',function(){
      var pending=false;
      try{pending=!!(round&&round.pending)}catch(e){}
      if(!pending)safeCall(function(){return activateDropForStart()});
    });

    byId('jgiClubPrev').addEventListener('click',function(){moveClub(-1)});
    byId('jgiClubNext').addEventListener('click',function(){moveClub(1)});
    byId('jgiClubTrack').addEventListener('click',function(){byId('clubMoreBtn')?.click()});

    var swipeStart=null;
    byId('jgiClubTrack').addEventListener('pointerdown',function(e){swipeStart=e.clientX});
    byId('jgiClubTrack').addEventListener('pointerup',function(e){
      if(swipeStart===null)return;
      var dx=e.clientX-swipeStart;
      swipeStart=null;
      if(Math.abs(dx)>28)moveClub(dx<0?1:-1);
    });

    byId('jgiNextShot').addEventListener('click',function(){
      var pending=null;
      try{pending=round&&round.pending?round.pending:null}catch(e){}
      if(pending){byId('shotResultBtn')?.click();return}
      var club=selectedClubName();
      if(club==='Putter')safeCall(function(){return openPutt()});
      else safeCall(function(){return startShot(club)});
      setTimeout(syncAll,0);
    });

    ui.querySelector('.jgi-round-nav').addEventListener('click',function(e){
      var b=e.target.closest('button[data-screen]');
      if(!b)return;
      safeCall(function(){return showScreen(b.dataset.screen)});
    });

    function syncAll(){
      syncTop();
      syncHole();
      syncClub();
      syncNext();
      syncDistance();
      updateGreenReference();
    }

    setRecommendedClub();
    buildHoleMenu();
    syncAll();
    setInterval(syncAll,350);
  });
})();
