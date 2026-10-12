# JGI COURSE INTELLIGENCE STANDARD V1.0

**Status:** Official Standard  
**Version:** V1.0  
**Course Intelligence Version:** `JGI_COURSE_INTELLIGENCE_V1`  
**Initial Reference Course:** Jagorawi Golf & Country Club — Old Course

---

## 1. 목적

JGI Player는 Golf Intelligence에서 받은 코스 GPS 원본 데이터를 단순 지도 표시용으로만 사용하지 않는다.

코스의 실제 지형과 구조를 분석하여 각 Shot에 필요한 Course Context를 자동 생성하고, 장기적으로 Player별 반복 Miss Pattern과 Risk Pattern을 발견하기 위한 기초 데이터로 사용한다.

기본 구조:

```text
Golf Intelligence Course Geometry
        ↓
JGI Course Intelligence
        ↓
Shot Course Context
        ↓
Player Result
        ↓
Pattern Detection
        ↓
Risk Prediction
        ↓
Live Action
```

---

## 2. 핵심 원칙

1. Golf Intelligence가 제공하는 원본 좌표는 그대로 보존한다.
2. JGI가 계산하는 값은 Derived Data로 별도 관리한다.
3. 원본 Course Geometry를 계산 결과로 덮어쓰지 않는다.
4. 코스 분석값에는 계산 Version을 보존한다.
5. 임의의 위험 점수보다 실제 거리·폭·방향·좌표를 우선 저장한다.
6. 동일 Course Data는 재사용하며 매 Shot마다 외부 API를 다시 호출하지 않는다.

현재 Course Intelligence Version:

```text
JGI_COURSE_INTELLIGENCE_V1
```

---

## 3. Golf Intelligence 원본 데이터

현재 Jagorawi Old Course에서 사용하는 주요 원본 코스 데이터:

- Tee 위치 및 Tee 구역
- Fairway 경계
- Green 위치 및 Green 경계
- Bunker 경계
- Water / Hazard 경계
- Hole 전체 경계
- Hole GPS Reference
- Course / Hole ID

Scorecard 데이터:

- Par
- Tee별 거리
- Stroke Index
- Course Rating
- Slope

Jagorawi Old Course의 누락됐던 Scorecard / Tee 관련 정보는 별도 제공된 실제 Scorecard 데이터를 이용하여 보완하였다.

---

## 4. JGI 자동 계산 항목

Golf Intelligence 원본 좌표를 이용하여 다음 값을 JGI가 자동 계산한다.

### 4.1 `fairwayWidth`

Fairway 경계를 이용해 홀 진행 방향을 따라 일정 간격으로 실제 폭을 계산한다.

현재 기본 계산 간격:

```text
5m
```

예:

```text
180m → 21.4m
190m → 27.7m
200m → 28.6m
210m → 27.4m
```

단순히 `NARROW / WIDE`로만 저장하지 않는다.

실제 숫자를 보존한 뒤 Player 데이터가 충분히 쌓였을 때 개인별 위험 구간을 분석한다.

예:

```text
Player A → Fairway Width 22m 이하에서 Driver Miss 증가
Player B → Fairway Width 18m 이하에서만 Miss 증가
```

따라서 고정된 Narrow 기준을 Course Raw Data에 임의 적용하지 않는다.

---

## 5. `dogleg`

저장 항목:

```text
applicable
direction
angleDeg
signedAngleDeg
lateralDeviationM
stationM
turnPoint
distanceToTurnM
source
```

예:

```text
direction = RIGHT
angleDeg = 30.7
distanceToTurnM = 252.4m
```

Dogleg는 단순 LEFT / RIGHT만 저장하지 않고 실제 각도와 꺾이는 위치를 보존한다.

현재 계산 방식은 Tee–Green 기준선과 Fairway 중심 흐름을 비교하여 의미 있게 벗어나는 지점을 Turn Point로 계산한다.

### Par 3 처리

Par 3는 Dogleg 분석 대상에서 제외한다.

Jagorawi Old Course의 Par 3:

```text
Hole 3
Hole 6
Hole 8
Hole 11
Hole 13
```

위 홀은:

```text
applicable = false
direction = STRAIGHT
angleDeg = 0
```

으로 처리한다.

---

## 6. `hazardDistance`

Player의 예상 Landing Point를 기준으로 가장 가까운 Water / Hazard까지의 거리를 계산한다.

저장 항목:

```text
type
nearestM
side
featureIndex
basis
source
version
```

예:

```text
type = WATER
side = RIGHT
nearestM = 18.4
```

단순히 홀 전체에서 가장 가까운 Hazard를 사용하는 것이 아니라 해당 Shot의 Landing Context와 연결한다.

---

## 7. `landingZoneWidth`

선택한 Club의 예상 Carry 또는 Player가 지정한 Target을 기준으로 예상 Landing Zone의 Fairway Width를 계산한다.

저장 항목:

```text
widthM
landingDistanceM
basis
point
projectionErrorM
source
version
```

Basis 예:

```text
CLUB_CARRY
PLAYER_TARGET
```

Player가 Target을 별도로 지정하지 않은 경우 Club Carry를 이용한다.

Target이 지정된 경우 Target 위치를 우선 사용한다.

---

## 8. `courseRisk`

`courseRisk`는 현재 하나의 임의 점수로 만들지 않는다.

예:

```text
risk_score = 8
```

같은 방식은 사용하지 않는다.

대신 실제 관찰 가능한 구조를 저장한다.

```text
left
  type
  distanceM

right
  type
  distanceM

narrowness
  startFairwayWidthM
  landingZoneWidthM

dogleg
  applicable
  direction
  angleDeg
  lateralDeviationM
  distanceToTurnM

source
version
```

이 값들을 장기 Player Data와 연결하여 개인별 Risk를 나중에 계산한다.

---

## 9. Shot Course Context 연결

Shot 시작 시 다음 데이터를 연결한다.

```text
Player GPS
+ Hole
+ Club
+ Club Carry
+ Target
+ Cached Course Intelligence
        ↓
Shot Course Context
```

저장 핵심 항목:

```text
fairwayWidth
dogleg
hazardDistance
landingZoneWidth
courseRisk
```

Course Context는 Shot 당시 사용한 Version을 보존해야 한다.

나중에 Course Geometry 또는 계산 알고리즘이 변경되더라도 과거 Shot이 어떤 Version의 Course Context를 사용했는지 확인할 수 있어야 한다.

---

## 10. 18홀 사전 계산 및 Cache

Jagorawi Old Course는 Hole 1부터 Hole 18까지 Course Intelligence 계산을 적용한다.

Course가 로드될 때 18홀 데이터를 사전 계산하여 Cache한다.

```text
Course Load
        ↓
Hole 1–18 Geometry Analysis
        ↓
Course Intelligence Cache
        ↓
Round Shot에서 재사용
```

라운드 중 매 Shot마다 Golf Intelligence 데이터를 새로 분석하거나 API를 다시 호출하지 않는다.

비용 및 성능 원칙:

```text
1 Round ≠ 30–40 Course API Calls

1 Course Data Load
+ Cached Course Intelligence
+ Shot Context Lookup
```

---

## 11. Jagorawi Old Course 전수 검증

Hole 1–18 전체에서 Fairway Section 계산이 정상 생성되는 것을 확인하였다.

```text
18 Holes Valid
0 Geometry Calculation Errors
```

Par 3를 제외한 Par 4 / Par 5에서는 Dogleg Geometry 계산이 가능하다.

검증 예:

```text
Hole 4
RIGHT
약 16.1°
Turn Point 약 231m

Hole 5
LEFT
약 21.4°
Turn Point 약 230m

Hole 7
RIGHT
약 30.7°
Turn Point 약 252m

Hole 9
RIGHT
약 30.8°
Turn Point 약 233m

Hole 14
RIGHT
약 35.5°
Turn Point 약 236m
```

위 값들은 Golf Intelligence 원본 좌표를 기반으로 JGI가 계산한 Derived Geometry이다.

사람이 수동 측정한 공식 Course Design 값과 동일하다고 단정하지 않는다.

---

## 12. Player Pattern 분석 활용

Course Intelligence는 단순 Course Description이 아니다.

장기적으로 다음 관계를 찾기 위한 Feature이다.

```text
Course Design
× Club
× Target
× Player State
        ↓
Shot Result
        ↓
Miss Risk
```

분석 예:

- Fairway Width가 일정 값 이하일 때 Right Miss 증가
- Right Water가 Landing Zone에 가까울 때 Penalty 증가
- 특정 Dogleg 방향 / 각도에서 Driver Miss 증가
- 특정 Club × Narrow Landing Zone 조합
- Hazard Side × Player State 조합
- Green Approach Structure × Distance 조합

JGI는 미리 원인을 단정하지 않는다.

충분한 Player Data가 축적된 후 실제 관찰된 관계와 Confidence를 기준으로 판단한다.

---

## 13. Target Data — 설계 확정 / 구현 전

Player가 실제 어디를 Target으로 했는지는 Course Context와 Shot Result 사이의 중요한 Decision Data다.

Shot 입력 화면에서는 복잡한 좌표 입력 대신 다음 3개 선택을 사용한다.

```text
LEFT
CENTER
RIGHT
```

기본값:

```text
CENTER
```

향후 저장 구조:

```text
target_zone
- LEFT
- CENTER
- RIGHT

target_source
- SYSTEM_DEFAULT
- PLAYER_SELECTED
- JGI_RECOMMENDED

target_lat
target_lng
target_fairway_width_m
```

LEFT / CENTER / RIGHT는 단순 문자열만 저장하지 않고 Landing Zone의 실제 Fairway Geometry를 이용해 Target GPS 좌표로 변환한다.

예:

```text
Fairway Width = 30m

LEFT zone center
CENTER
RIGHT zone center
```

현재 이 Target 입력 방식은 **제품 설계로 확정되었으나 메인 코드에는 아직 구현되지 않았다.**

따라서 현재 상태는:

```text
DESIGN CONFIRMED
NOT YET IMPLEMENTED
```

로 관리한다.

---

## 14. 현재 구현 상태

### IMPLEMENTED

- Golf Intelligence Course Geometry 사용
- Jagorawi Old Hole 1–18 적용
- Jagorawi Old Scorecard 보완
- `fairwayWidth` 자동 계산
- `dogleg` 자동 계산
- `hazardDistance` 자동 계산
- `landingZoneWidth` 자동 계산
- `courseRisk` 구조 생성
- Course Intelligence Cache
- Shot `courseContext` 연결
- `JGI_COURSE_INTELLIGENCE_V1` Version 관리

### DESIGN CONFIRMED / NOT YET IMPLEMENTED

- Shot 입력 화면 Target LEFT / CENTER / RIGHT
- CENTER 기본 자동 선택
- `target_zone`
- `target_source`
- LEFT / CENTER / RIGHT 실제 GPS Target 좌표 자동 변환
- JGI Recommended Target

---

## 15. 현재 핵심 구조

```text
Golf Intelligence
        ↓
Course Geometry Raw Data
        ↓
JGI Course Intelligence V1
        ↓
Fairway Width
Dogleg
Hazard Distance
Landing Zone Width
Course Risk
        ↓
Club + Target + Player GPS
        ↓
Shot Result
        ↓
Player Personal Baseline
        ↓
Repeated Pattern Detection
        ↓
Risk Prediction
        ↓
Next Action
```

JGI의 목적은 단순히 코스 정보를 보여주는 것이 아니다.

최종 질문은 다음과 같다.

> 이 Player가 어떤 Course Context와 Decision 상황에서 반복적으로 문제를 만드는가?

이 질문에 답할 수 있도록 Course Geometry와 Shot Data를 연결한다.
