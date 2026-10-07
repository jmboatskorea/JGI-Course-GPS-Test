/* WHOOP Pilot: today snapshot may be attached to a round; tokens never enter browser storage. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let today={status:'disconnected',connected:false,snapshot:null},busy=false;
  let device=null,characteristic=null,samples=[],lastAt=0,bleMessage='BLE 연결 전',bleBusy=false;
  const metrics=s=>[['Recovery',s?.recovery,'%'],['Sleep',s?.sleep,'%'],['HRV',s?.hrv,'ms'],['Resting HR',s?.restingHR,'bpm'],['Day Strain',s?.dayStrain,'']].map(([label,value,unit])=>`<div class="whoopMetric"><span>${label}</span><strong>${Number.isFinite(value)?(label==='Day Strain'?value.toFixed(1):Math.round(value)):'—'} <small>${Number.isFinite(value)?unit:''}</small></strong></div>`).join('');
  const statuses={'credentials pending':'credentials pending · WHOOP 서버 설정 대기',disconnected:'WHOOP · 연결 전',connected:'WHOOP CONNECTED',no_today_data:'WHOOP CONNECTED · 오늘 데이터 없음',whoop_unavailable:'WHOOP · 데이터를 불러오지 못했습니다',reconnect_required:'WHOOP · 다시 연결해 주세요',loading:'WHOOP · 확인 중'};
  function advice(s){return Number.isFinite(s?.recovery)&&s.recovery<34?'첫 홀에서는 넓은 센터 타깃을 선택하세요.':'첫 홀에서는 평소의 준비 루틴을 유지하세요.';}
  function render(){
    const s=today.snapshot;
    document.querySelectorAll('[data-whoop-status]').forEach(el=>el.textContent=statuses[today.status]||'WHOOP · 연결 확인 필요');
    document.querySelectorAll('[data-whoop-metrics]').forEach(el=>el.innerHTML=metrics(s));
    document.querySelectorAll('[data-whoop-date]').forEach(el=>el.textContent=s?'WHOOP cycle · '+new Date(s.cycleStart).toLocaleString()+' · 조회 '+new Date(s.capturedAt).toLocaleTimeString():'미제공 데이터는 —로 표시합니다.');
    document.querySelectorAll('[data-whoop-condition]').forEach(el=>el.textContent=s&&Number.isFinite(s.recovery)?'WHOOP Recovery '+Math.round(s.recovery)+'%. 개인 평소 기준과의 비교는 아직 제공하지 않습니다.':'오늘 상태를 해석할 WHOOP 데이터가 없습니다.');
    document.querySelectorAll('[data-whoop-advice]').forEach(el=>el.textContent=advice(s));
    document.querySelectorAll('[data-whoop-disconnect]').forEach(el=>el.disabled=busy||!today.connected);
    document.querySelectorAll('[data-whoop-refresh]').forEach(el=>el.disabled=busy);
    document.querySelectorAll('[data-whoop-connect]').forEach(el=>el.disabled=today.status==='credentials pending'||!el.closest('.card').querySelector('[data-whoop-consent]').checked);
    const pre=typeof round!=='undefined'?round?.whoopToday:null;
    $('whoopPreRound').innerHTML=metrics(pre);
    $('whoopPreRoundDate').textContent=pre?'라운드 시작 전 저장 · '+new Date(pre.capturedAt).toLocaleString():'라운드 시작 전 WHOOP snapshot 없음';
    renderLive();
  }
  async function refresh(){
    if(busy)return;busy=true;today={status:'loading',connected:false,snapshot:null};render();
    try{const r=await fetch('/api/whoop/today',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await r.json();today={status:data.status,connected:!!data.connected,snapshot:data.snapshot||null};}catch{today={status:'whoop_unavailable',connected:false,snapshot:null};}
    finally{busy=false;render();}
  }
  function renderLive(){
    const now=Date.now();samples=samples.filter(s=>now-s.at<=300000);
    const current=lastAt&&now-lastAt<=15000&&device?.gatt?.connected?samples.at(-1)?.hr:null;
    $('whoopHR').textContent='♥ '+(current??'—')+' bpm';$('whoopLiveEntry').textContent='♥ '+(current??'—');
    let load='—',delta=null;
    if(current&&samples.length>1&&now-samples[0].at>=60000){
      const base=samples.filter(s=>s.at<samples[0].at+60000);
      const recent=samples.filter(s=>now-s.at<=30000);
      if(base.length&&recent.length){const avg=a=>a.reduce((n,s)=>n+s.hr,0)/a.length;delta=avg(recent)-avg(base);load=delta>=20?'HIGH':delta>=10?'RISING':'NORMAL';}
    }
    $('whoopLoad').textContent='Load · '+load;
    $('whoopTrendText').textContent='5-minute trend · '+(delta===null?'— · 1분 이상 수신 후 표시':(delta>=0?'+':'')+Math.round(delta)+' bpm · 첫 1분 평균 대비 최근 30초 평균');
    $('whoopBleStatus').textContent=bleBusy?'기기 연결 중':current?bleMessage:lastAt&&device?.gatt?.connected?'수신 대기 · 이전 값은 숨깁니다':bleMessage;
    $('whoopBleConnect').disabled=bleBusy||!!device?.gatt?.connected;
    const lo=Math.min(...samples.map(s=>s.hr),60),hi=Math.max(...samples.map(s=>s.hr),100);
    $('whoopTrendLine').setAttribute('points',samples.map(s=>((s.at-(now-300000))/300000*300).toFixed(1)+','+(65-(s.hr-lo)/(hi-lo)*55).toFixed(1)).join(' '));
  }
  function measurement(event){
    const v=event.target.value;if(v.byteLength<2)return;
    const wide=!!(v.getUint8(0)&1);if(wide&&v.byteLength<3)return;
    // If the device exposes a contact sensor, omit measurements with no contact.
    if((v.getUint8(0)&4)&&!(v.getUint8(0)&2))return;
    const hr=wide?v.getUint16(1,true):v.getUint8(1);if(hr<25||hr>240)return;
    lastAt=Date.now();samples.push({at:lastAt,hr});if(samples.length>3000)samples.shift();renderLive();
  }
  function clearLive(message){samples=[];lastAt=0;bleMessage=message;characteristic?.removeEventListener('characteristicvaluechanged',measurement);characteristic=null;renderLive();}
  async function connectBLE(){
    if(!navigator.bluetooth?.requestDevice){bleMessage='이 브라우저는 Web Bluetooth를 지원하지 않습니다. Android Chrome 또는 iPhone Bluefy를 사용하세요.';renderLive();return;}
    if(bleBusy)return;bleBusy=true;renderLive();
    try{
      device=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
      device.addEventListener('gattserverdisconnected',()=>{clearLive('BLE 연결 끊김 · 다시 연결하세요.');},{once:true});
      const server=await device.gatt.connect();const service=await server.getPrimaryService('heart_rate');characteristic=await service.getCharacteristic('heart_rate_measurement');
      samples=[];lastAt=0;characteristic.addEventListener('characteristicvaluechanged',measurement);await characteristic.startNotifications();bleMessage='BLE 연결됨 · 심박 수신 대기';
    }catch(e){device?.gatt?.disconnect();clearLive(e.name==='NotFoundError'?'기기 선택 취소':'BLE 연결 실패 · HR Broadcast와 브라우저 권한을 확인하세요.');}
    finally{bleBusy=false;renderLive();}
  }
  $('whoopBleConnect').onclick=connectBLE;
  $('whoopBleDisconnect').onclick=()=>{device?.gatt?.disconnect();clearLive('BLE 연결 해제');};
  $('whoopLiveEntry').onclick=()=>{showScreen('body');render();};
  $('whoopBackRound').onclick=()=>{showScreen(round?'round':'setup');};
  $('whoopBackSetup').onclick=()=>showScreen('setup');
  $('whoopStartRound').onclick=()=>{startRoundWithCondition();};
  document.querySelectorAll('[data-whoop-refresh]').forEach(el=>el.onclick=refresh);
  document.querySelectorAll('[data-whoop-consent]').forEach(el=>el.onchange=render);
  document.querySelectorAll('[data-whoop-form]').forEach(el=>el.onsubmit=e=>{
    if(!el.closest('.card').querySelector('[data-whoop-consent]').checked){e.preventDefault();return;}
    sessionStorage.setItem('JGI_WHOOP_RETURN',JSON.stringify({course:$('courseSelect').value,nine:$('courseNine').value,tee,sgBenchmarkMode,stateCollectionLevel,condition:!$('conditionScreen').classList.contains('hidden')}));
  });
  document.querySelectorAll('[data-whoop-disconnect]').forEach(el=>el.onclick=async()=>{
    if(busy)return;busy=true;render();
    try{const r=await fetch('/api/whoop/disconnect',{method:'POST',credentials:'same-origin'});if(!r.ok)throw new Error();const data=await r.json();today={status:'disconnected',connected:false,snapshot:null};device?.gatt?.disconnect();clearLive('BLE 연결 해제');if(data.notice)alert(data.notice);}
    catch{alert('연결 해제를 완료하지 못했습니다. 다시 시도해 주세요.');}
    finally{busy=false;render();}
  });
  window.JGI_WHOOP={render,refresh,capture:r=>{if(today.connected&&today.snapshot&&Date.now()-new Date(today.snapshot.capturedAt).getTime()<900000)r.whoopToday={...today.snapshot};}};
  const result=new URLSearchParams(location.search).get('whoop');
  if(result){
    try{const saved=JSON.parse(sessionStorage.getItem('JGI_WHOOP_RETURN')||'null');if(saved){$('courseSelect').value=saved.course;$('courseNine').value=saved.nine;tee=normalizeTeeName(saved.tee);sgBenchmarkMode=saved.sgBenchmarkMode;stateCollectionLevel=normalizeCollectionLevel(saved.stateCollectionLevel);setSelected($('teeSegment'),tee);syncSgBenchmarkUI();syncStatePlanUI();$('introScreen').classList.add('hidden');$('appTopbar').classList.remove('hidden');showScreen(saved.condition?'condition':'body');}}catch{}
    sessionStorage.removeItem('JGI_WHOOP_RETURN');const url=new URL(location.href);url.searchParams.delete('whoop');history.replaceState(null,'',url.pathname+url.search+url.hash);
    if(result!=='connected')alert(result==='cancelled'?'WHOOP 연결을 취소했습니다.':'WHOOP 연결 실패 · 서버 설정을 확인해 주세요.');
  }
  render();refresh();setInterval(renderLive,5000);
})();
