// JGI Strokes Gained Benchmark V1
// TOUR: Mark Broadie PGA TOUR ShotLink expected-strokes baseline (2003-2010, 8M+ shots).
// Handicap lenses: MODELED, not observed handicap-population expected-strokes tables.
// Female Scratch V0.1: MODELED_PUBLIC_CALIBRATED, built from public female-golf
// performance anchors and the JGI expected-strokes structure. It is NOT LPGA ShotLink.
// Units: off-green distance = yards; putting distance = feet.
window.JGI_SG_BENCHMARK_DATA={
  version:"JGI_SG_V1_2026-10-01",
  extensionVersion:"JGI_FEMALE_SG_V0_1_2026-10-07",
  labels:{
    TOUR:"Tour",
    FEMALE_SCRATCH:"여자 Scratch · V0.1",
    SCRATCH:"Scratch",
    HCP_5:"HCP 5",
    HCP_10:"HCP 10",
    HCP_15:"HCP 15",
    HCP_20:"HCP 20",
    HCP_25:"HCP 25"
  },
  levels:{
    TOUR:{handicap:null,type:"MEASURED",sex:"MALE",profile:null,useOffset:false},
    FEMALE_SCRATCH:{
      handicap:null,type:"MODELED",sex:"FEMALE",profile:"FEMALE_SCRATCH",useOffset:false,
      source:"PUBLIC_CALIBRATED",quality:"LOW",level:"SCRATCH"
    },
    SCRATCH:{handicap:0,type:"MODELED",sex:"MALE",profile:null,useOffset:true},
    HCP_5:{handicap:5,type:"MODELED",sex:"MALE",profile:null,useOffset:true},
    HCP_10:{handicap:10,type:"MODELED",sex:"MALE",profile:null,useOffset:true},
    HCP_15:{handicap:15,type:"MODELED",sex:"MALE",profile:null,useOffset:true},
    HCP_20:{handicap:20,type:"MODELED",sex:"MALE",profile:null,useOffset:true},
    HCP_25:{handicap:25,type:"MODELED",sex:"MALE",profile:null,useOffset:true}
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
    {name:"Published handicap gap model: 65% long / 20% short / 15% putting",role:"HANDICAP_MODEL",type:"MODELED"},
    {name:"Public female Scratch approach, short-game and putting performance anchors",role:"FEMALE_SCRATCH_CALIBRATION",type:"MODELED_PUBLIC_CALIBRATED"},
    {name:"USGA women par-distance guidance",role:"FEMALE_TEE_CALIBRATION",type:"MODELED_PUBLIC_CALIBRATED"}
  ],
  profiles:{
    FEMALE_SCRATCH:{
      id:"FEMALE_SCRATCH",
      version:"JGI_FEMALE_SG_V0_1_2026-10-07",
      benchmarkSex:"FEMALE",
      benchmarkLevel:"SCRATCH",
      benchmarkPopulation:"FEMALE_SCRATCH_AMATEUR",
      benchmarkType:"MODELED_PUBLIC_CALIBRATED",
      source:"PUBLIC_CALIBRATED",
      quality:"LOW",
      maxValidatedOffGreenYards:400,
      confidence:{tee:"LOW",fairway:"MEDIUM",rough:"LOW",sand:"LOW",recovery:"LOW",puttingShort:"MEDIUM",puttingLong:"LOW"},
      note:"Testing benchmark only. Female-specific public anchors calibrate the curve; Rough/Sand/Recovery and long-distance sections remain lower-confidence modeled values. Not an LPGA official benchmark.",
      offGreen:[
        {yards:10,fairway:2.39,rough:2.55,sand:2.64,recovery:3.66},
        {yards:30,fairway:2.61,rough:2.79,sand:2.75,recovery:3.66},
        {yards:50,fairway:2.74,rough:2.95,sand:3.00,recovery:3.87},
        {yards:75,fairway:2.89,rough:3.10,sand:3.38,recovery:4.00},
        {yards:100,tee:2.95,fairway:3.05,rough:3.27,sand:3.48,recovery:4.05},
        {yards:125,fairway:3.19,rough:3.42,sand:3.53,recovery:4.11},
        {yards:150,tee:3.15,fairway:3.37,rough:3.62,sand:3.67,recovery:4.23},
        {yards:175,fairway:3.58,rough:3.81,sand:3.89,recovery:4.34},
        {yards:200,tee:3.45,fairway:3.77,rough:4.00,sand:4.13,recovery:4.45},
        {yards:220,tee:3.58},
        {yards:250,tee:3.62,fairway:4.12,rough:4.29,sand:4.48,recovery:4.60},
        {yards:300,tee:3.90,fairway:4.38,rough:4.50,sand:4.64,recovery:4.80},
        {yards:350,tee:4.17},
        {yards:400,tee:4.46,fairway:4.71,rough:4.90,sand:5.29,recovery:5.35},
        {yards:420,tee:4.60},
        {yards:450,tee:4.81},
        {yards:500,tee:5.16},
        {yards:550,tee:5.48},
        {yards:600,tee:5.75}
      ],
      putting:[
        {feet:1,expected:1.01},
        {feet:2,expected:1.03},
        {feet:3,expected:1.12},
        {feet:4,expected:1.25},
        {feet:5,expected:1.38},
        {feet:6,expected:1.45},
        {feet:8,expected:1.56},
        {feet:10,expected:1.68},
        {feet:15,expected:1.84},
        {feet:20,expected:1.95},
        {feet:30,expected:2.07},
        {feet:40,expected:2.15},
        {feet:50,expected:2.23},
        {feet:60,expected:2.31},
        {feet:90,expected:2.48},
        {feet:100,expected:2.53}
      ]
    }
  },
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

(function installFemaleScratchBenchmark(){
  function install(){
    if(window.JGI_FEMALE_SG_V0_1_INSTALLED)return;
    if(typeof window.sgBenchmarkInfo!=="function"||typeof window.sgExpected!=="function")return;
    window.JGI_FEMALE_SG_V0_1_INSTALLED=true;

    const data=window.JGI_SG_BENCHMARK_DATA;
    const female=data.profiles.FEMALE_SCRATCH;
    const baseInfo=window.sgBenchmarkInfo;
    const baseExpected=window.sgExpected;

    window.sgBenchmarkInfo=function(r){
      const mode=r?.sgBenchmarkMode||(typeof sgBenchmarkMode!=="undefined"?sgBenchmarkMode:null)||"PLAYER";
      if(mode==="FEMALE_SCRATCH"){
        return {
          mode:"FEMALE_SCRATCH",requestedMode:"FEMALE_SCRATCH",
          label:data.labels.FEMALE_SCRATCH,handicap:null,type:"MODELED",fallback:false,
          sex:"FEMALE",level:"SCRATCH",profile:"FEMALE_SCRATCH",useOffset:false,
          source:female.source,quality:female.quality,profileVersion:female.version
        };
      }
      return arguments.length?baseInfo(r):baseInfo();
    };

    window.sgExpected=function(distanceM,lie,info){
      const resolved=info||window.sgBenchmarkInfo();
      if(resolved?.profile!=="FEMALE_SCRATCH")return baseExpected(distanceM,lie,resolved);
      const key=typeof sgLieKey==="function"?sgLieKey(lie):null;
      if(!key||!Number.isFinite(Number(distanceM)))return null;
      if(key==="green"){
        const feet=Math.max(0,Number(distanceM)*3.2808399);
        if(feet<=0)return 0;
        return interpolateRows(female.putting,feet,"feet","expected");
      }
      const yards=Number(distanceM)*1.0936133;
      let lieKey=key;
      if(lieKey==="tee"&&yards<100)lieKey="fairway";
      if(lieKey!=="tee"&&yards>female.maxValidatedOffGreenYards)return null;
      return interpolateRows(female.offGreen,yards,"yards",lieKey);
    };

    function applyFemaleMetadata(r){
      if(!r||r.sgBenchmarkMode!=="FEMALE_SCRATCH")return r;
      r.sgBenchmarkSex="FEMALE";
      r.sgBenchmarkLevel="SCRATCH";
      r.sgBenchmarkPopulation=female.benchmarkPopulation;
      r.sgBenchmarkType=female.benchmarkType;
      r.sgBenchmarkSource=female.source;
      r.sgQuality=female.quality;
      r.sgProfileVersion=female.version;
      r.sgDataVersion=data.version;
      return r;
    }

    const segment=document.getElementById("sgBenchmarkSegment");
    if(segment&&!segment.querySelector('[data-v="FEMALE_SCRATCH"]')){
      const button=document.createElement("button");
      button.type="button";
      button.dataset.v="FEMALE_SCRATCH";
      button.textContent="여자 Scratch";
      segment.insertBefore(button,segment.children[1]||null);
    }

    const baseEmptyRound=window.emptyRound;
    if(typeof baseEmptyRound==="function"){
      window.emptyRound=function(){
        return applyFemaleMetadata(baseEmptyRound.apply(this,arguments));
      };
    }

    const startButton=document.getElementById("startRoundBtn");
    if(startButton){
      startButton.addEventListener("click",function(){
        setTimeout(function(){
          if(typeof round!=="undefined"&&round){
            applyFemaleMetadata(round);
            if(typeof save==="function")save();
            if(typeof renderRound==="function")renderRound();
          }
        },0);
      });
    }

    const baseBeginPending=window.beginPending;
    if(typeof baseBeginPending==="function"){
      window.beginPending=function(){
        const ok=baseBeginPending.apply(this,arguments);
        if(ok&&typeof round!=="undefined"&&round?.pending&&round.sgBenchmarkMode==="FEMALE_SCRATCH"){
          applyFemaleMetadata(round);
          round.pending.courseContext={
            ...(round.pending.courseContext||{}),
            sgBenchmarkSex:"FEMALE",
            sgBenchmarkLevel:"SCRATCH",
            sgBenchmarkSource:female.source,
            sgBenchmarkQuality:female.quality,
            sgBenchmarkProfileVersion:female.version
          };
          if(typeof save==="function")save();
        }
        return ok;
      };
    }

    const performanceNote=document.querySelector("#performanceScreen .sgBox .sgStatus");
    if(performanceNote){
      performanceNote.innerHTML="<b>라운드 시작 시 선택한 기준으로 고정</b>됩니다. Tour는 공개 PGA TOUR 기대타수 기준이며, 여자 Scratch V0.1은 공개 여성 성과자료로 보정한 JGI 테스트 모델입니다. 공식 LPGA Benchmark가 아닙니다.";
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else setTimeout(install,0);
})();
