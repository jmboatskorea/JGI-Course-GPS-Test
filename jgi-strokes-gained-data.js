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
