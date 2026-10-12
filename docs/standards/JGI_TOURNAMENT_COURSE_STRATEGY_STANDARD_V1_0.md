# JGI TOURNAMENT COURSE STRATEGY STANDARD V1.0

**Project:** JGI Player  
**Document Type:** Tournament Course Strategy / Personalized Course Strategy Generation Standard  
**Version:** V1.0  
**Defined:** 2026-10-09  
**Status:** Active Design Standard / Field Validation Required  
**Primary Output:** Player-specific 18-hole Tournament Strategy HTML  
**Initial Validation Case:** Park Jieun × Ora Country Club × National Sports Festival setup  

## 1. 목적

JGI Tournament Course Strategy는 일반 Yardage Book이 아니다.

목적은 다음과 같다.

> **공식 대회 조건 + 실제 Course GPS + Player의 실제 경기 데이터 + Weather를 결합하여, 각 Hole에서 이 Player가 무엇을 해야 하는지 설명하는 개인 맞춤형 경기 공략을 생성한다.**

기본 구조:

```text
Tournament Setup
+ Golf Intelligence Course Geometry
+ Player Club / Round / Miss Data
+ Weather
        ↓
JGI Tournament Strategy Engine
        ↓
Hole Situation
        ↓
Plan A / Plan B
        ↓
Target / Club / Landing Zone / Avoid Miss
        ↓
18-Hole Tournament Strategy HTML
```

핵심 질문:

> **이 Hole에서 이 Player가 가장 적은 Expected Loss로 가장 좋은 Scoring Chance를 만드는 선택은 무엇인가?**

---

## 2. 핵심 원칙

1. Raw / Verified Data를 우선한다.
2. 없는 데이터는 만들지 않는다.
3. Player별로 전략이 달라져야 한다.
4. Course Description보다 Player Decision이 중심이다.
5. 화면은 경기 중 즉시 이해할 수 있어야 한다.
6. Satellite Map은 실제 Map을 사용하고 가상 Course 이미지는 사용하지 않는다.
7. Polygon은 내부 계산에 사용하고 화면에는 필요한 정보만 표시한다.
8. 공식 경기거리와 GPS 계산거리를 분리한다.
9. Weather는 경기 전날/당일 실제 예보로 최종 업데이트한다.
10. 모든 Derived 값은 재계산 가능해야 한다.
11. GI에 없는 Green/Hazard/OB/Tree 경계는 추정하지 않는다.
12. Strategy HTML 생성 때문에 DB/Schema/Main/Production을 자동 변경하지 않는다.

---

## 3. 필수 입력

### 3.1 Tournament Setup

가능하면 다음 값을 받는다.

```text
event_name
course_id
course_name
competition_dates
round_count
start_hole
start_time
official_hole_distance
hole_par
tournament_tee
pin / green setup
```

공식 경기거리의 Source는 대회 공식 Distance Sheet / Tournament Setup을 우선한다.

### 3.2 Golf Intelligence Course Data

필수 Course Geometry 후보:

```text
Tee Polygon / Tee Reference
Fairway Polygon
Green Polygon
Green Center
Bunker Polygon
Water / Hazard Polygon
Hole ID
Course ID
```

추가 가능:

```text
Dogleg
Scorecard
Stroke Index
Green Slope
Elevation
```

Golf Intelligence 원본 좌표는 그대로 보존한다.

### 3.3 Player Data

최소:

```text
Club
Club Carry / Distance Range
Recent Observed Distance
Miss Profile
Handedness
Player Level / HCP
Recent Round Data
```

가능하면:

```text
club-by-club dispersion
left / right miss frequency
short / long miss
lie-based result
target source
course context
shot result
SG
personal baseline
```

중요:

```text
GPS start → end distance ≠ Carry
```

GPS Observed Shot Distance와 Carry는 같은 값으로 취급하지 않는다.

### 3.4 Weather

준비 단계 기본 시간:

```text
07:00
10:00
13:00
15:00
17:00
```

경기 직전에는:

```text
Tournament Day Forecast
Wind Direction
Wind Speed
Gust
Rain
Temperature
```

로 교체한다.

---

## 4. Source Priority

### 거리 / Par

```text
1. Tournament Official Distance Sheet
2. Verified Tournament Setup
3. Golf Intelligence Scorecard
```

### Course Geometry

```text
1. Golf Intelligence GPS Geometry
2. Verified Manual GPS Capture
3. 그 외 Source
```

### Player Performance

```text
1. Valid JGI Round Raw Data
2. Player Bag / Club Profile
3. Recent Observed Reference
```

### Weather

```text
1. 경기 당일 최신 Forecast
2. 경기 전날 Forecast
3. Historical / Climatology Reference
```

---

## 5. NO INVENTION RULE

### Green

Golf Intelligence 데이터에 Green Polygon이 1개만 있으면:

```text
GI Green 1개만 사용
```

한다.

Satellite Image에서 다른 Green처럼 보이는 영역을 보고 다음을 추정하지 않는다.

```text
Right Green
Second Green
Alternative Green
```

### Hazard

GPS에 없는 다음 항목을 Satellite Image만 보고 만들지 않는다.

```text
OB
Tree
Rough Safe Width
Penalty Boundary
```

### Tee Color

Tee Polygon에 Color Mapping이 없으면:

```text
Red Tee Confirmed
Ladies Tee Confirmed
```

라고 단정하지 않는다.

Tournament Distance와 가장 가까운 Tee Polygon을 선택한 경우:

```text
Tournament Tee Candidate
```

로 표시한다.

### Missing Data

없는 값은 다음 중 하나로 처리한다.

```text
UNAVAILABLE
확인 필요
Not Provided by GI
```

---

## 6. Official Distance와 GPS Distance 분리

Hole Header의 총거리는:

```text
Tournament Official Distance
```

를 사용한다.

다음은 GPS Geometry에서 계산한다.

```text
Tee → IP
IP → Green
Hazard Distance
Fairway Width
Green Front / Center / Back
```

예:

```text
Official Distance = 293m
GPS Tee Candidate → Green Center = 301m
```

서로 달라도 강제로 동일하게 만들지 않는다.

---

## 7. Tournament Tee Candidate 선택

Tournament Tee GPS가 직접 제공되지 않은 경우:

1. Hole의 모든 GI Tee Polygon Center 계산
2. 각 Tee Center → GI Green Center GPS 직선거리 계산
3. Tournament Official Distance와 차이가 가장 작은 Tee 선택
4. 표시명은 `Tournament Tee Candidate`

기본:

```text
candidate =
argmin(
  abs(
    tee_to_green_distance
    - official_tournament_distance
  )
)
```

공식거리와 차이가 크면 Confidence를 낮추고 현장 재검증한다.

---

## 8. Hole Coordinate System / Map Orientation

모든 Hole 분석은 Tee → Green 진행축 기준이다.

최종 Map은 항상:

```text
GREEN ↑

   Hole

TEE ↓
```

즉:

> **선수 시점에서 Tee가 아래, Green이 위**

가 되도록 자동 회전한다.

Map과 GPS Overlay는 같은 각도로 회전하고:

```text
Club Label
Distance
IP
Wind Text
```

는 정방향을 유지한다.

---

## 9. Fairway Width 계산

Fairway Width는 반드시 GI Fairway Polygon을 사용한다.

Satellite Image에서 Rough까지 포함한 폭을 추정하지 않는다.

Club Landing Station 예:

```text
Driver Carry = 180m
3W Carry = 160m
7W Carry = 147.5m
```

해당 Station에서 Hole Axis에 수직인 Line과 Fairway Polygon의 교차점을 구한다.

```text
Fairway Width
=
Left Intersection
-
Right Intersection
```

실제 숫자를 보존한다.

Display Category가 필요할 때만 별도 Derived Layer에서:

```text
0–19m   Narrow
20–28m  Normal
29m+    Wide
```

를 사용할 수 있다.

---

## 10. IP / Landing Point

Club별 예상 Landing Station에서 Fairway Section Center를 기본 IP 후보로 계산한다.

Target Zone 후보:

```text
LEFT
CENTER
RIGHT
```

기본 Target은:

```text
CENTER
```

이다.

LEFT / RIGHT Target은 Player Miss와 Hazard Risk를 비교한 뒤 결정한다.

---

## 11. Green Front / Center / Back

Green Front / Back은 북쪽/남쪽 기준이 아니다.

반드시:

```text
Current IP → GI Green Center
```

Approach Ray와 Green Polygon의 교차를 사용한다.

```text
First Intersection = Green Front
Green Center       = Center
Last Intersection  = Green Back
```

---

## 12. Hazard Distance

Hazard는 GI가 제공하는 Polygon만 사용한다.

Landing Point 기준:

```text
Nearest Bunker
Nearest Water
```

까지의 Polygon Edge 최소거리를 계산한다.

저장 후보:

```text
type
nearestM
side
featureIndex
basis
source
version
```

Display Risk Clearance:

```text
0–5m    위험 가까움
6–10m   주의
11–15m  여유 있음
>15m    Active Warning 밖
```

---

## 13. Player Miss × Hazard Logic

예:

```text
Player Driver Miss = LEFT
Hazard = LEFT
```

이면:

```text
LEFT Target 감소 또는 금지
CENTER / RIGHT-CENTER 검토
```

핵심:

```text
Same-Side Miss Risk
=
Player Miss Direction
×
Hazard Side
```

단:

- 1 Round만으로 숫자 확률을 만들지 않는다.
- Profile Miss와 최근 Round Result가 다르면 둘 다 보존한다.
- 충분한 Sample 전에는 `LEFT tendency`처럼 표현한다.

---

## 14. Plan A / Plan B

### Plan A

같은 Hole에서:

> **Expected Loss가 가장 낮고 Scoring Chance가 가장 좋은 기본 추천 전략**

이다.

무조건 Driver가 Plan A가 아니다.

### Plan B

다음 조건에서 사용하는 대안:

```text
Strong Wind
Player Club Confidence Low
Tournament Position
Bad Lie
Tee Setup Change
Landing Risk Change
```

예:

```text
Plan A
Driver → Center

Plan B
3W → Center
```

Par 5 예:

```text
Plan A
Driver → Center
6I Lay-up
80m Leave

Plan B
Driver → Center
3W Advance
50m Leave
```

---

## 15. Par 4 Club Choice Logic

Club 후보별로 다음을 비교한다.

```text
Landing Width
Nearest Hazard
Remaining Distance
Next Club Fit
Player Miss
Wind
```

핵심 비교:

```text
Safety Gain
vs
Remaining Distance Cost
```

예:

```text
Driver FW Width 29.5m
3W FW Width     29.5m

Driver Leave 121m
3W Leave     142m
```

이면:

```text
3W Safety Gain ≈ 0
Remaining Distance +21m
```

이므로 Driver가 우선될 수 있다.

반대로:

```text
Driver FW 25m
3W FW 29m
```

이면 3W가 실제 Safety Gain을 제공하므로 Plan A 후보가 될 수 있다.

---

## 16. Par 3 Strategy

Par 3는 Tee → Green 직접 공략이다.

비교:

```text
Official Distance
GPS Front
GPS Center
GPS Back
Player Club Range
Front Hazard
Wind
```

예:

```text
Green Front 131m
Center 144m
Back 157m

9W 135–150m
7W 140–155m
```

이면:

```text
A = 9W
B = 7W in Headwind / Back Condition
```

같이 구성한다.

---

## 17. Par 5 Strategy

Par 5는 반드시:

```text
Tee Shot
→ 2nd Shot
→ Preferred 3rd Distance
```

까지 계산한다.

Driver IP 이후:

```text
3W
7W
9W
5I
6I
```

등의 2nd Landing Station을 비교한다.

각 후보:

```text
2nd Landing Width
Nearest Hazard
Remaining Distance
Player Preferred 3rd Club
```

을 비교한다.

핵심:

> **가장 멀리 보내는 2nd가 항상 Plan A가 아니다.**

예:

```text
3W → FW 24.8m → 47m Leave
6I → FW 32.9m → 83m Leave
```

Player가 80m에서 강하고 47m Partial Shot 변동성이 크면:

```text
6I Lay-up
```

이 Plan A가 될 수 있다.

---

## 18. Wind Direction Convention

기상 Wind Direction은 일반적으로:

```text
FROM direction
```

이다.

예:

```text
NW Wind
=
Wind FROM Northwest
=
Air moves toward Southeast
```

변환:

```text
wind_to_bearing
=
(wind_from_bearing + 180) mod 360
```

---

## 19. Hole-Relative Wind

Hole Bearing:

```text
tee_to_green_bearing
```

Relative Angle:

```text
relative_angle
=
(wind_to_bearing - hole_bearing + 360) mod 360
```

Player View Arrow:

```text
↑  Tailwind
↓  Headwind
→  Left-to-Right Crosswind
←  Right-to-Left Crosswind

↗ Left-to-Right Tail-Cross
↖ Right-to-Left Tail-Cross
↘ Left-to-Right Head-Cross
↙ Right-to-Left Head-Cross
```

화살표는 절대 북쪽 기준이 아니라:

> **Player가 Tee에서 Green을 바라보는 기준의 체감 바람**

이다.

---

## 20. Wind Time Slots

기본:

```text
07:00
10:00
13:00
15:00
17:00
```

표시 예:

```text
10:00
←
우→좌 횡풍
4.8m/s
```

Historical / Climatology는:

```text
REFERENCE
NOT FINAL
```

로 표시한다.

---

## 21. Weather Update Workflow

### D-7 ~ D-3

```text
Climatology
+
Long Range Forecast
```

### D-1

Tournament Day Forecast로 1차 Update.

### 경기 당일 아침

최종:

```text
Start Time
Start Hole
Wind
Rain
Temperature
```

반영 후 HTML 재생성.

핵심:

> **Course Geometry와 Player Strategy Base는 유지하고 Weather Layer만 재계산한다.**

---

## 22. Start Hole / Tee Time

Two-Tee Start가 있으면 실제 Hole Number는 유지한다.

```text
10 Start
10 → 11 → ... → 18 → 1 → ... → 9
```

10번을 Hole 1로 재명명하지 않는다.

향후:

```text
tee_time
pace_per_hole
expected_hole_time
```

기반으로 각 Hole 예상시간과 Weather Time Slot을 연결한다.

---

## 23. Strategy Classification

### ATTACK

- Main Club Landing Zone이 안정적
- Club을 줄여도 Safety Gain이 작음
- 짧고 선호되는 Approach Distance 생성
- Birdie Chance가 구조적으로 좋음

### KEEP

- Par 확보 우선
- 기본 공략으로 GIR Chance 충분
- 과도한 공격 이득이 작음

### CAUTION

- 좁은 Landing Zone
- Player Miss와 Hazard가 같은 Side
- Long Approach Exposure
- Club Choice가 큰 Risk 생성

### SWING

- Risk-Reward Par 5
- Tournament Position에 따라 공격 강도 변화
- 후반 핵심 Hole
- Plan A와 B의 결과 차이가 큼

V1에서는 설명 가능한 Strategy Heuristic이다.

---

## 24. Player Data Confidence

JGI 기본 학습 단계:

```text
1 Round   → 오늘의 문제 확인
5 Rounds  → 반복 패턴 발견 시작
10 Rounds → Personal Baseline 형성
20+ Rounds → Context × State × Miss Risk 분석
```

Tournament Strategy Confidence:

```text
1–4 Rounds
LOW

5–9 Rounds
LOW–MEDIUM

10–19 Rounds
MEDIUM

20–30 Rounds
HIGH Candidate

30+ Rounds
HIGH
단, Context Coverage 확인 필수
```

중요:

> 라운드 수보다 Context Coverage와 Club별 유효 Sample이 더 중요하다.

---

## 25. Sample 수가 부족할 때

예:

```text
3W Recent Sample = 1
```

최근 1샷으로 Club Profile을 덮어쓰지 않는다.

```text
Strategy Basis = Stable Player Club Profile
Recent Observation = Reference
Confidence = LOW
```

---

## 26. GPS Data Quality

사용 Player Shot GPS는 다음을 확인한다.

```text
position_source
gps_accuracy
manual_edit
edit_history
```

정확도가 낮은 Shot은 Precision Distance Model에서 제외하거나 Confidence를 낮춘다.

`Observed Shot Distance`를 `Carry`라고 부르지 않는다.

---

## 27. Final Hole Page 구조

### Header

```text
Hole Number
Par
Official Tournament Distance
Strategy Classification
GPS Tee Candidate → GI Green Distance
```

### Map

```text
Actual Satellite Map
TEE ↓
GI GREEN ↑
Plan A Target Line
Plan B Target Line
Landing IP
150 / 100 / 50m Guide
Verified Bunker / Water
```

### Key Numbers

```text
Landing Distance
Fairway Width
Green Front
Green Center
Green Back
Remaining Distance
```

### Wind

```text
07
10
13
15
17
```

각각:

```text
Hole-relative Arrow
Wind Effect
Wind Speed
```

### Strategy

```text
PLAN A
PLAN B
Avoid Miss
One-Line Player Instruction
```

---

## 28. Player Instruction

Hole마다 반드시:

```text
선수에게 한 줄
```

을 만든다.

예:

```text
“드라이버 중앙. 120m 남기고 GIR.”
```

조건:

- 짧다.
- 경기 중 기억 가능하다.
- 한 번에 행동 1개 또는 2개 이하.
- 긴 설명은 Strategy Reason에 둔다.

---

## 29. 18-Hole Quick Sheet

상세 Hole Page 외에 경기 중 빠르게 보는 Summary를 만들 수 있다.

예:

| Hole | Tee / Club | Target | Next | Mode |
|---|---|---|---|---|
| 1 | Driver | Center | 120m | ATTACK |
| 2 | 9W | Green Center | — | KEEP |
| 3 | Driver | Center | 128m | CAUTION |

Quick Sheet는 상세 분석을 대체하지 않는다.

---

## 30. Tournament Day Output

### A. Base Strategy

```text
Player
+
Course
+
Tournament Setup
```

기반 18-Hole HTML.

### B. Daily Strategy

```text
Base Strategy
+
Round Start Time
+
Weather
```

업데이트 버전.

### C. Quick Sheet

경기 중 빠르게 보는 압축 버전.

---

## 31. HTML 구현 원칙

Mobile-first.

필수:

```text
Hole 1–18 Navigation
Responsive Layout
Actual Satellite Tiles
GPS Overlay
TEE Bottom / GREEN Top
Labels Upright
Plan A / Plan B
Wind Panel
```

가상 골프장 Illustration을 Base Map으로 사용하지 않는다.

---

## 32. Course Data Cost / Cache

기존 JGI Course Architecture 유지:

```text
1 Round ≠ 30–40 API Calls
```

기본:

```text
1 Course Data Load
+
Cached Course Geometry
+
Player-specific Strategy Calculation
+
Weather Update
```

동일 Course 여러 Player 사용:

```text
Course Geometry = Shared Cache
Player Strategy = Player-specific Derived Data
```

---

## 33. 자동 생성 시스템 입력

향후 Product Input:

```text
player_id
course_id
event_id
round_date
start_hole
tee_time
```

처리:

```text
Load Player Baseline
Load Cached Course
Load Tournament Setup
Load Weather
Calculate 18 Holes
Render HTML
```

---

## 34. 자동 생성 처리 순서

```text
STEP 1  Tournament Setup Validate
STEP 2  Course Geometry Load
STEP 3  Tournament Tee Candidate Resolve
STEP 4  Player Club / Miss / Baseline Load
STEP 5  Hole 1–18 IP Calculation
STEP 6  Fairway Width / Hazard / Green Distance
STEP 7  Par 5 Lay-up Calculation
STEP 8  Plan A / B Selection
STEP 9  Wind Relative Conversion
STEP 10 Hole Classification
STEP 11 Player One-Line Instruction
STEP 12 HTML Render
STEP 13 QA Validation
```

---

## 35. QA Checklist

### Tournament

- [ ] Official Hole Distance 일치
- [ ] Par 일치
- [ ] Start Hole 유지
- [ ] Tournament Tee가 Confirmed인지 Candidate인지 구분

### Course

- [ ] GI Green만 사용
- [ ] Missing Right Green 생성 안 함
- [ ] Fairway Width는 Fairway Polygon 기반
- [ ] Hazard는 Verified GI Polygon만 사용
- [ ] Satellite Image 추정값 없음

### Player

- [ ] Carry와 Observed Distance 구분
- [ ] Low Sample Club을 과도하게 보정하지 않음
- [ ] Miss Profile과 Hazard Side 비교
- [ ] Personal Baseline Confidence 확인

### Map

- [ ] Tee 아래
- [ ] Green 위
- [ ] Label 정방향
- [ ] Plan A/B Line 구분
- [ ] 150/100/50 Guide 위치 검증

### Wind

- [ ] FROM → TO Direction 변환
- [ ] Hole Bearing 반영
- [ ] Player View Arrow 확인
- [ ] Reference Weather와 Actual Forecast 구분
- [ ] 경기일 Forecast로 최종 Update

### Strategy

- [ ] Plan A가 무조건 Driver가 아님
- [ ] Plan B가 실제 대안임
- [ ] Par 5는 2nd까지 계산
- [ ] Avoid Miss 명확
- [ ] One-Line Instruction 존재

---

## 36. 금지 사항

```text
Satellite Image만 보고 Right Green 생성
Satellite Image만 보고 OB 생성
Satellite Image만 보고 Tree Risk 수치화
공식 거리 - Club 거리 단순 차감으로 Remaining 확정
Observed Shot Distance를 Carry로 사용
한 라운드 Miss를 확률모델로 과장
1개 Sample로 Club Profile 덮어쓰기
Plan A = Driver / Plan B = 3W 고정
모든 Hole을 같은 Strategy로 처리
Course Polygon을 화면 전체에 과도하게 채우기
경기일 Forecast 없이 오래된 Weather를 Final로 표시
```

---

## 37. Implementation Scope Rule

Tournament Strategy HTML 생성 자체는:

```text
Derived Analysis / Presentation
```

이다.

이 기능 생성 때문에 자동으로 다음을 수행하지 않는다.

```text
DB Migration
Schema Change
Dependency Change
Main / Production Deploy
```

DB / Schema / Dependency 변경이 필요하면 별도 Objective로 분리하고 사용자 승인을 받는다.

---

## 38. V1 핵심 정의

> **JGI Tournament Course Strategy는 Tournament Official Setup, Golf Intelligence GPS Geometry, Player의 실제 Club / Miss / Round Data, 그리고 Weather를 결합하여 Hole별 Plan A / Plan B와 Target을 생성하는 개인 맞춤형 경기 공략 시스템이다. Course Raw Data는 추정하지 않고, GI에 없는 Green / Hazard는 만들지 않는다. Map은 항상 Tee가 아래, Green이 위인 Player View로 표시한다. Official Distance와 GPS Derived Distance를 분리하고, Fairway Width, Hazard Distance, Green Front / Center / Back, Par 5 Lay-up, Wind Relative Direction을 자동 계산한다. Player Data가 부족하면 Club Profile과 낮은 Confidence를 사용하고, 약 10 Round부터 Personal Baseline, 20+ Round부터 Context × Miss Risk를 적극 반영한다. 경기 전날과 당일에는 Weather Layer를 다시 계산하여 동일 HTML Strategy를 Update한다.**

---

## 39. Version 관리

현재 Version:

```text
JGI_TOURNAMENT_COURSE_STRATEGY_V1_0
```

향후 V1.x 후보:

```text
Tournament Tee Confidence
Weather Speed Adjustment
Expected Hole Time
Automatic Club Dispersion
Player-specific Preferred Lay-up
Strategy Confidence
Expected Score / Expected Loss
```

V2 후보:

```text
Full Personal Risk Model
Course Design × Club × Distance × Player State
Tournament Position-aware Strategy
Probabilistic Plan A / B
```

---

**Source of Truth:** 이 문서는 JGI Tournament Course Strategy V1의 공식 생성 방법 및 운영 Logic 기준으로 사용한다.
