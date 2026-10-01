// JGI Strokes Gained Benchmark V1
// Tour baseline: published Mark Broadie / PGA TOUR ShotLink expected-strokes anchors.
// Handicap lenses are MODELED, not observed handicap-population tables.
// Model: score 72+H vs Tour baseline ~71; gap split 65% long / 20% short / 15% putting,
// distributed over 14 long shots / 7 short-game shots / 30 putts.
// Units: off-green distance = yards, putting distance = feet.
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
    note:"Handicap expected-strokes values are modeled lenses derived from the measured Tour baseline."
  },
  sources:[
    {
      name:"Mark Broadie / PGA TOUR ShotLink expected-strokes baseline",
      role:"TOUR_BASELINE",
      type:"MEASURED_PUBLISHED_BASELINE"
    },
    {
      name:"Published handicap gap model: 65% long / 20% short / 15% putting",
      role:"HANDICAP_MODEL",
      type:"MODELED"
    }
  ],
  offGreen:[
    {yards:20, fairway:2.40,rough:2.59,sand:2.53},
    {yards:40, fairway:2.60,rough:2.78,sand:2.82},
    {yards:60, fairway:2.70,rough:2.91,sand:3.15},
    {yards:80, fairway:2.75,rough:2.96,sand:3.24},
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
    {yards:420,tee:4.02,fairway:4.15,rough:4.34,sand:4.73,recovery:4.79},
    {yards:440,tee:4.08,fairway:4.20,rough:4.39,sand:4.78,recovery:4.84},
    {yards:460,tee:4.17,fairway:4.29,rough:4.48,sand:4.87,recovery:4.93},
    {yards:480,tee:4.28,fairway:4.40,rough:4.59,sand:4.98,recovery:5.04},
    {yards:500,tee:4.41,fairway:4.53,rough:4.72,sand:5.11,recovery:5.17},
    {yards:520,tee:4.54,fairway:4.66,rough:4.85,sand:5.24,recovery:5.30},
    {yards:540,tee:4.65,fairway:4.78,rough:4.97,sand:5.36,recovery:5.42},
    {yards:560,tee:4.74,fairway:4.86,rough:5.05,sand:5.44,recovery:5.50},
    {yards:580,tee:4.79,fairway:4.91,rough:5.10,sand:5.49,recovery:5.55},
    {yards:600,tee:4.82,fairway:4.94,rough:5.13,sand:5.52,recovery:5.58}
  ],
  putting:[
    {feet:1,expected:1.00},
    {feet:2,expected:1.01},
    {feet:3,expected:1.05},
    {feet:4,expected:1.13},
    {feet:5,expected:1.23},
    {feet:6,expected:1.34},
    {feet:7,expected:1.42},
    {feet:8,expected:1.50},
    {feet:10,expected:1.61},
    {feet:15,expected:1.78},
    {feet:20,expected:1.87},
    {feet:25,expected:1.94},
    {feet:30,expected:2.00},
    {feet:40,expected:2.12},
    {feet:50,expected:2.21},
    {feet:60,expected:2.28},
    {feet:90,expected:2.40},
    {feet:100,expected:2.45}
  ]
};
