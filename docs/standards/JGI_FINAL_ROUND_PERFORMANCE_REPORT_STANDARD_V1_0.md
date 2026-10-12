# JGI FINAL ROUND PERFORMANCE REPORT STANDARD V1.0

**Project:** JGI Player  
**Document Type:** Final Round Review / Performance Diagnosis / Report Generation Standard  
**Version:** V1.0  
**Defined:** 2026-10-08  
**Status:** Active Design Standard / Field Validation Required  
**Implementation Profile:** `JGI_FINAL_ROUND_REPORT_V1_0_2026-10-08`  
**Primary Outputs:** Player Report / Coach On-Course Lesson Report / PDF / Image / WhatsApp Summary  
**Parent Standards:**

- `JGI_SYSTEM_STANDARDS_INDEX_V1_0.md`
- `JGI_RAW_SHOT_DATA_STANDARD_V1_0.md`
- `JGI_SHOT_EVENT_FLOW_STANDARD_V1_0.md`
- `JGI_COURSE_INTELLIGENCE_STANDARD_V1_0.md`
- `JGI_STROKES_GAINED_STANDARD_V1_0.md`
- `JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md`
- `JGI_STATE_SAMPLING_STANDARD_V1_1.md`

---

## 1. 목적

이 문서는 Player가 달라져도 동일한 분석 원칙을 적용하여 다음 결과물을 자동 생성하기 위한 공식 기준이다.

1. 오늘 라운드에서 **실제로 어디서 타수를 잃었는지**
2. 전통적인 성공률만으로는 보이지 않는 **결과 품질과 경기 가치**
3. 다음 라운드에서 가장 빠르게 타수를 줄일 수 있는 **Immediate Scoring Priority**
4. 장기적으로 더 낮은 스코어 수준으로 가기 위한 **Development Priority**
5. 현재 유지해야 할 **Performance Strength**
6. 다음 라운드에서 다시 확인할 **Verification Checkpoint**
7. Player 또는 Coach가 전달할 수 있는 전문 형식의 **Final Performance Report**

JGI Final Round Report의 목적은 단순한 스코어 요약이나 SG 순위표가 아니다.

핵심 질문은 다음과 같다.

> **오늘 무엇이 일어났는가?**  
> **왜 전통 지표와 실제 경기 가치가 다르게 보이는가?**  
> **무엇을 먼저 고쳐야 하는가?**  
> **무엇을 장기적으로 발전시켜야 하는가?**  
> **무엇은 강점으로 유지해야 하는가?**

---

## 2. 핵심 철학

JGI는 다음 두 질문을 반드시 분리한다.

### A. 어디서 타수를 잃었는가?

SG, Penalty, Three-Putt, Miss, Expected Strokes 변화 등 **현재 라운드의 실제 손실**을 본다.

### B. 무엇을 발전시켜야 앞으로 더 낮은 스코어를 칠 수 있는가?

Distance, Result Quality, Remaining Distance, Proximity, Decision, Repeated Exposure 등 **장기적인 Performance Ceiling**을 본다.

두 질문은 같은 답을 가질 수도 있지만 반드시 같아야 하는 것은 아니다.

예:

```text
Biggest Category Loss  = Tee Shot OTT
Immediate Priority     = 0.5–1.5m Short Putting
Development Priority   = Tee Shot Distance
Maintain Strength      = Approach Play
```

따라서 다음 규칙을 사용한다.

> **가장 낮은 SG Category를 자동으로 Today's Priority로 지정하지 않는다.**

---

## 3. 시스템 역할 분리

### 3.1 DB / Local Source

Raw Data와 원본 Event를 보존한다.

- Player / Round / Hole / Shot Identity
- Start / End Position
- Lie
- Club
- Shot Purpose
- Target
- Result
- Putt
- Penalty
- Course Context Snapshot
- Player State
- Wearable Snapshot
- Edit History
- Data Quality

### 3.2 Calculation Engine

재현 가능한 계산과 분류를 담당한다.

- Score
- Traditional Metrics
- Shot Distance
- Remaining Distance
- Proximity
- SG Shot
- SG Category
- Category Total
- Event Ranking
- Concentration
- Opportunity Count
- Priority Candidate Features

### 3.3 Priority Engine

현재 라운드의 문제와 장기 개발 과제를 분리한다.

- Biggest Category Loss
- Worst Single Event
- Immediate Scoring Priority
- Development Priority
- Maintain Strength
- Secondary Monitor

### 3.4 JGI Agent / LLM

계산된 사실을 전문적인 문장으로 설명한다.

JGI Agent는:

- Raw Data를 임의 생성하지 않는다.
- SG 값을 임의 계산하거나 수정하지 않는다.
- 저장되지 않은 원인을 단정하지 않는다.
- 관찰된 사실과 해석을 구분한다.
- 데이터 품질과 Benchmark Quality를 명시한다.
- 최종 행동 제안은 1개 또는 제한된 수로 제시한다.

---

## 4. 분석 단위

최종 리포트는 다음 단위로 분석한다.

```text
Player
+ Round Result
+ Traditional Result
+ Result Quality
+ Performance Value
+ Course / Shot Context
+ Player State
+ Data Quality
        ↓
Diagnosis
        ↓
Priority
        ↓
Action
        ↓
Next-Round Verification
```

분석 최소 단위는 Shot이며, 최종 설명 단위는 다음을 모두 지원한다.

- Single Shot / Putt
- Hole
- Situation
- Club
- Distance Band
- Lie
- Shot Purpose
- SG Category
- Front / Back
- Round Phase
- One Round
- Multiple Rounds

---

## 5. 필수 입력 데이터

### 5.1 Player Profile

최소 필드:

```text
player_id
player_name
player_sex
player_handicap
benchmark_mode
benchmark_version
target_score
tee_set
club_profile
```

### 5.2 Round

```text
round_id
course_id
course_version
tee_set
started_at
completed_at
round_status
score
par
to_par
```

### 5.3 Shot

최소 후보:

```text
hole_number
hole_par
shot_id
shot_sequence
club
shot_purpose
start_lie
end_lie
start_position
end_position
start_distance_to_hole
end_distance_to_hole
target_position
target_distance
holed
penalty_strokes
sg_category
sg_shot
expected_before
expected_after
position_source
gps_accuracy_start
gps_accuracy_end
```

### 5.4 Course Context

```text
fairway_width
landing_zone_width
left_risk
right_risk
dogleg
hazard_distance
distance_to_green_edge
course_context_version
```

### 5.5 Putting

```text
putt_sequence
distance_m
slope
break
result
remaining_distance_m
putt_sg
expected_before
expected_after
```

### 5.6 Player State / Wearable

선택 데이터:

```text
pressure
interference
tension
confidence
focus
thought_focus
whoop_recovery
whoop_sleep
hrv
resting_hr
```

State가 없더라도 Performance Report는 생성한다.

---

## 6. Benchmark와 Data Quality 정책

### 6.1 Benchmark 고정

한 라운드의 SG Benchmark는 해당 라운드 내에서 고정한다.

Report에는 최소한 다음을 표시한다.

```text
benchmark_label
benchmark_population
benchmark_type
benchmark_quality
benchmark_version
```

예:

```text
Female HCP 5.0 · JGI Female SG V0.2 · Modeled
Base: Female Scratch Amateur V0.1
Quality: LOW
```

### 6.2 Confidence 상한

최종 Report Confidence는 다음 중 가장 낮은 수준을 초과하지 않는다.

```text
benchmark_quality
shot_position_quality
pin_quality
lie_quality
course_context_quality
sample_quality
```

예:

```text
Benchmark Quality = LOW
Shot Position Quality = HIGH
Final Report Confidence ≤ LOW
```

### 6.3 Missing Policy

필수 데이터가 없으면:

- 0으로 대체하지 않는다.
- 성공 또는 실패로 임의 분류하지 않는다.
- `UNAVAILABLE` 또는 `확인 필요`로 표시한다.
- 해당 Metric을 Priority 선정 근거에서 제외하거나 Confidence를 낮춘다.

---

## 7. 공식 분석 순서

Final Round Report는 다음 순서로 생성한다.

### STEP 1 — Round Validation

- 18홀 또는 유효 완료 Hole 확인
- Score 검증
- Shot / Putt / Penalty 수 확인
- Duplicate / Missing / Edit 상태 확인
- Benchmark Metadata 확인

### STEP 2 — Traditional Result 계산

- Score / To Par
- Fairway Hit
- GIR
- Up & Down
- Sand Save
- Total Putts
- Three-Putts
- Penalty

### STEP 3 — Result Quality 계산

- Tee Shot Distance
- Remaining Distance after Tee Shot
- Playable Position
- Approach Proximity
- Green Hit Quality
- Miss Quality
- Short-Game Leave Distance
- Lag-Putt Leave Distance
- Short-Putt Conversion
- Recovery / Lay-up Next-State Quality

### STEP 4 — Performance Value 계산

- SG Total
- SG OTT
- SG APP
- SG ARG
- SG PUTT
- Penalty Adjustment
- Shot / Putt SG Ranking

### STEP 5 — Hidden Pattern Detection

Traditional Result와 Performance Value가 다른 방향을 가리키는지 확인한다.

### STEP 6 — Diagnosis

각 Category를 하위 원인 후보로 분해한다.

### STEP 7 — Priority Selection

- Biggest Category Loss
- Worst Single Event
- Immediate Scoring Priority
- Development Priority
- Maintain Strength
- Secondary Monitor

### STEP 8 — Report Generation

- Executive Summary
- Evidence
- Action Plan
- Next-Round Verification
- Methodology & Confidence

---

## 8. 5-Layer Performance Analysis Framework

모든 Category는 아래 다섯 층으로 분석한다.

### Layer 1 — Traditional Result

결과 여부와 성공률.

예:

- Fairway Hit
- GIR
- Up & Down
- Putts
- Three-Putts
- Penalty

### Layer 2 — Result Quality

같은 성공이라도 결과의 질이 어땠는지 본다.

예:

- Fairway에 갔지만 얼마나 멀리 갔는가?
- Green에 올렸지만 핀까지 얼마나 남겼는가?
- Recovery 후 다음 샷은 쉬워졌는가?
- 첫 퍼트 이후 몇 m를 남겼는가?

### Layer 3 — Performance Value

Benchmark 대비 Shot Value.

- SG OTT
- SG APP
- SG ARG
- SG PUTT
- Shot SG

### Layer 4 — Diagnosis

실제 개선 영역을 분리한다.

- Accuracy
- Distance
- Proximity
- Decision
- Execution
- Conversion
- Penalty
- Data Quality

### Layer 5 — Priority

- Immediate
- Development
- Maintain
- Monitor

---

## 9. Traditional Metric 정의와 분모

혼합 지표를 하나의 성공률처럼 표시하지 않는다.

### 9.1 Tee Shot Metrics

다음을 분리한다.

```text
par45_fairway_hit_rate
par45_playable_position_rate
driver_only_fairway_hit_rate
par3_green_hit_rate
center_direction_rate
penalty_free_tee_rate
```

다음과 같은 혼합 표기는 기본 Report에서 사용하지 않는다.

```text
Par 3 Green Hit + Par 4/5 Fairway Hit = Tee Accuracy
```

불가피하게 사용하면 분모와 정의를 반드시 표시한다.

### 9.2 Distance 명칭

GPS Start/End 위치로 계산한 값은:

```text
Observed Shot Distance
```

로 표시한다.

Launch Monitor나 별도 센서가 없는 경우 이를 `Carry Distance`라고 부르지 않는다.

구분:

```text
observed_shot_distance_m
carry_distance_m
total_distance_m
```

### 9.3 Approach Metrics

다음을 분리한다.

```text
green_attack_attempts
green_attack_hits
layup_attempts
recovery_attempts
approach_proximity
miss_quality
```

`Second Shot Green Hit Rate`를 Approach 능력의 단독 평가 기준으로 사용하지 않는다.

### 9.4 Putting Metrics

다음을 분리한다.

```text
total_putts
three_putts
first_putt_distance
lag_putt_leave_distance
short_putt_attempts
short_putt_make_rate
short_putt_sg
```

---

## 10. Hidden Performance Pattern Detector

### 10.1 좋아 보이지만 실제로는 손실인 패턴

#### A. High Fairway Hit + Negative OTT

가능한 진단 후보:

- Distance 부족
- Tee Shot 이후 긴 Remaining Distance
- 전략적 Club Choice
- 낮은 Position Value
- Benchmark / Distance Capture 문제

Report 표현:

```text
Accuracy: Strength
Distance / Position Value: Development Area
```

#### B. Normal Total Putts + Negative PUTT

가능한 진단 후보:

- 짧은 퍼트 실패 집중
- 특정 거리 Conversion 저하
- Three-Putt 집중
- Lag Distance Control

Report 표현:

```text
Total Putts alone did not identify the primary loss.
Short-Putt Conversion was the direct scoring issue.
```

#### C. Green Hit + Low APP Value

가능한 진단 후보:

- 긴 First-Putt Distance
- 낮은 Proximity Quality
- 안전한 Green Zone이나 불리한 위치
- Approach 후 Three-Putt Exposure

#### D. Fairway Recovery + Negative Shot Value

가능한 진단 후보:

- 선호하지 않는 거리
- 다음 샷 각도 불리
- Long Approach 재발생
- 위험요소가 계속 남음

---

### 10.2 나빠 보이지만 실제로는 강점인 패턴

#### A. Low GIR + Positive APP

가능한 해석:

- 좋은 Miss
- Fringe / Safe Zone
- Strong Proximity despite missed Green
- Lay-up 포함으로 GIR 분모 왜곡

#### B. Low Up & Down + Positive ARG

가능한 해석:

- Short-Game Shot은 양호
- Conversion Putting 실패
- Up & Down이 Short Game과 Putting을 혼합

#### C. Low Second-Shot Green Hit + Positive APP

가능한 해석:

- Par 5 Lay-up
- Hazard Avoidance
- Preferred Distance Setup
- Shot Purpose 혼합

---

## 11. Category별 공식 진단 틀

## 11.1 Tee Shot / OTT

### 입력

- OTT SG
- Par 4/5 Tee Shot 수
- Driver / Wood / Iron 구분
- Fairway Hit
- Playable Position
- Left / Right Miss
- Penalty
- Observed Distance
- Remaining Distance
- Landing Zone Width
- Risk
- Club Choice

### 하위 진단

```text
Accuracy
Distance Production
Position Quality
Penalty Control
Decision / Club Selection
Course Fit
Data Quality
```

### 해석 예

```text
Fairway Hit 높음 + Penalty 없음 + OTT 음수
→ Accuracy 문제로 단정하지 않음
→ Distance / Remaining Distance / Position Quality 우선 확인
```

### 개발 처방 전 필수 확인

Distance 문제로 판단되면 다음 중 원인을 구분해야 한다.

- Club Speed
- Ball Speed
- Smash Factor
- Impact Location
- Launch
- Spin
- Carry
- Equipment / Club Choice

JGI Round Data만으로 위 원인을 확정할 수 없으면:

```text
Launch Monitor Assessment Required
```

로 표시한다.

---

## 11.2 Approach / APP

### 입력

- APP SG
- Green Attack Attempts
- Green Hits
- Proximity
- Miss Direction
- Miss Depth
- Start Lie
- Club
- Distance Band
- Shot Purpose
- Hazard / Green Structure

### 하위 진단

```text
Distance Control
Direction Control
Proximity
Green-Attack Decision
Lay-up Quality
Miss Quality
Club-Distance Fit
```

### 중요 규칙

`Shot Sequence = 2`를 자동으로 Approach 성능으로 간주하지 않는다.

반드시 Shot Purpose를 확인한다.

```text
GREEN_ATTACK
LAYUP
RECOVERY
POSITIONING
```

---

## 11.3 Around-the-Green / ARG

### 입력

- ARG SG
- Green Edge Distance
- Lie
- Club
- Green Hit
- Leave Distance
- Up & Down
- Conversion Putt

### 하위 진단

```text
Contact / Execution
Leave Distance
Lie Difficulty
Bunker / Recovery
Conversion Putting
```

### 중요 규칙

Up & Down 실패를 자동으로 Short Game 실패로 분류하지 않는다.

```text
Short-Game End Quality
+
Conversion Putting
```

을 분리한다.

---

## 11.4 Putting / PUTT

### 입력

- PUTT SG
- Total Putts
- First-Putt Distance
- Three-Putts
- Distance Band
- Make / Miss
- Remaining Distance
- Slope / Break

### 거리 구간 예

```text
0–0.5m
0.5–1.0m
1.0–1.5m
1.5–2.0m
2–3m
3–5m
5–10m
10m+
```

### 하위 진단

```text
Short-Putt Conversion
Start-Line Control
Face Control
Lag Distance Control
Three-Putt Prevention
Slope / Break Context
```

### 중요 규칙

`Total Putts`만으로 Putting Priority를 정하지 않는다.

---

## 11.5 Penalty / Decision

### 입력

- Penalty Type
- Penalty Strokes
- Cause Shot
- Target
- Course Risk
- Club Choice
- Strategy Mode

### 하위 진단

```text
Execution Error
Decision Error
Club Selection
Target Selection
Risk Acceptance
Rule / Procedure
```

Penalty 원인을 알 수 없으면 특정 Decision에 귀속하지 않는다.

---

## 11.6 Player State / Wearable

### 분석 원칙

한 라운드에서는:

```text
Observed Association
```

으로만 표시한다.

예:

```text
Pressure 4–5 Sample에서 우측 Miss가 3/5회 관찰됨
```

금지 표현:

```text
Pressure 때문에 우측 Miss가 발생했다
```

누적 단계:

| Round Count | 허용 해석 |
|---:|---|
| 1R | 오늘의 관찰 |
| 2–4R | 라운드 간 비교 |
| 5–9R | 반복 패턴 후보 |
| 10–19R | Personal Baseline 비교 |
| 20R+ | Context Risk / 예측 후보 |

---

## 12. Priority Output Contract

Final Report는 최소한 다음 여섯 개를 출력한다.

### 12.1 Biggest Category Loss

가장 낮은 SG Category.

```text
OTT / APP / ARG / PUTT / PENALTY
```

이는 사실 기반 결과이며 Priority와 동일하지 않을 수 있다.

### 12.2 Worst Single Event

모든 Shot / Putt 중 가장 낮은 유효 SG Event.

최소 표시:

- Hole
- Shot / Putt
- Club 또는 Distance
- Start / End State
- Expected Before
- Expected After
- SG
- Data Quality

### 12.3 Immediate Scoring Priority

다음 연습 또는 다음 라운드에서 가장 빠르게 타수를 줄일 수 있는 **구체적인 상황 1개**.

좋은 예:

```text
0.5–1.5m Short Putting
100–130m Rough Approach
Par 5 Tee-Club Decision
Greenside Bunker Leave Distance
```

나쁜 예:

```text
Putting
Driver
Approach
```

### 12.4 Development Priority

현재 강점을 훼손하지 않으면서 장기적인 Scoring Ceiling을 낮출 영역 1개.

예:

```text
Accuracy를 유지한 Tee Shot Distance
Long Approach Exposure 감소
Preferred Lay-up Distance 확보
```

### 12.5 Maintain Strength

현재 Positive Value와 Result Quality가 함께 확인된 영역.

### 12.6 Secondary Monitor

현재 Priority는 아니지만 다음 라운드에서 확인할 영역.

---

## 13. Priority Selection Heuristic V1

이 Score는 통계적 확률모델이 아니라 V1 Report Priority의 일관성을 위한 **설명 가능한 운영 규칙**이다.

모든 항목은 0–5로 평가한다.

### 13.1 Immediate Priority Score

```text
Immediate Priority Score
= Direct Loss × 0.35
+ Loss Concentration × 0.25
+ Recurrence × 0.15
+ Actionability × 0.15
+ Confidence × 0.10
```

#### Direct Loss

현재 라운드에서 실제 SG 또는 Penalty 손실 크기.

#### Loss Concentration

특정 거리·상황에 손실이 집중됐는가.

예:

```text
3개의 Short Putt에서 PUTT 손실의 80% 발생
```

#### Recurrence

동일 상황이 반복됐는가.

#### Actionability

다음 세션에서 명확하게 훈련 가능한가.

#### Confidence

Data / Benchmark / Sample Quality.

### 13.2 Development Priority Score

```text
Development Priority Score
= Structural Gap × 0.30
+ Exposure × 0.25
+ Scoring Ceiling Impact × 0.25
+ Repeat Evidence × 0.10
+ Confidence × 0.10
```

#### Structural Gap

전통 지표는 좋아도 결과 품질이 낮은 구조적 차이.

예:

```text
High Fairway Hit + Low Distance + Long Remaining Distance
```

#### Exposure

라운드에서 얼마나 자주 해당 상황이 발생하는가.

#### Scoring Ceiling Impact

개선 시 다음 샷과 전체 Hole 난도를 지속적으로 낮출 가능성.

#### Repeat Evidence

다른 Round에서도 반복되는지.

### 13.3 Maintain Strength Score

```text
Strength Score
= Positive Performance Value × 0.45
+ Result Quality × 0.25
+ Repeatability × 0.15
+ Confidence × 0.15
```

### 13.4 동점 처리

동점이면 다음 우선순위를 사용한다.

1. Confidence가 높은 후보
2. 더 구체적인 상황 단위
3. 다음 라운드에서 검증 가능한 후보
4. Player의 기존 강점을 덜 훼손하는 후보

---

## 14. Report Claim Provenance Contract

Final Report의 모든 핵심 문장은 근거를 추적할 수 있어야 한다.

각 Claim은 내부적으로 다음 구조를 가진다.

```json
{
  "claim_id": "CLM-001",
  "claim_type": "FACT | DERIVED | DIAGNOSIS | RECOMMENDATION",
  "text": "Tee Shot의 가장 큰 개발 과제는 Distance다.",
  "source_fields": [
    "par45_fairway_hit_rate",
    "observed_driver_distance_m",
    "sg_ott",
    "remaining_distance_after_tee_m"
  ],
  "calculation_version": "JGI_FINAL_ROUND_REPORT_V1_0",
  "evidence_refs": ["H1-S1", "H5-S1", "H9-S1"],
  "confidence": "LOW | MEDIUM | HIGH",
  "agent_role": "EXPLANATION_ONLY"
}
```

### Claim Type 규칙

#### FACT

Raw 또는 직접 저장된 값.

#### DERIVED

Calculation Engine이 계산한 값.

#### DIAGNOSIS

여러 Metric을 규칙에 따라 해석한 결과.

#### RECOMMENDATION

Priority Engine이 선택한 행동 제안.

LLM은 Claim Provenance 없이 핵심 결론을 새로 만들지 않는다.

---

## 15. JGI Agent Answer Framework

자유 질문과 Final Report 문장은 다음 순서를 기본으로 한다.

1. **Core Answer**
2. **Key Numbers**
3. **Evidence Events**
4. **Why Traditional Metrics May Mislead**
5. **Diagnosis**
6. **Confidence / Limitation**
7. **One Action**
8. **Next Verification**

예:

```text
Core Answer
Short Putting이 Immediate Priority다.

Key Numbers
PUTT -3.41 / Short Putt 3개 -2.79

Evidence
6H, 8H, 9H

Diagnosis
Total Putts보다 1m 안팎 Conversion이 문제였다.

Action
0.5–1.5m Start-Line 훈련

Verification
다음 라운드 Short-Putt Make Rate와 SG 재확인
```

---

## 16. Final PDF 구조

기본 Player Report는 3페이지를 권장한다.

## PAGE 1 — Executive Performance Summary

필수 항목:

- Player / Date / Course / Tee
- Score / To Par
- Benchmark
- SG Total
- SG Category
- Biggest Category Loss
- Immediate Priority
- Development Priority
- Maintain Strength

## PAGE 2 — Diagnostic Evidence

필수 항목:

- Category Diagnostic
- Hidden Pattern
- Worst Single Event
- Top Loss Events
- Traditional Metric vs Performance Value
- Evidence Table

## PAGE 3 — Performance Plan

필수 항목:

- Immediate Action
- Development Plan
- Maintain Plan
- Secondary Monitor
- Next-Round Checkpoint
- Methodology
- Confidence

---

## 17. PDF 시각화 표준

권장 시각화는 최대 4개다.

### 17.1 SG Category Waterfall

```text
OTT / APP / ARG / PUTT / Penalty / Total
```

### 17.2 Result vs Value Matrix

예:

```text
Accuracy High / SG Negative
GIR Low / APP Positive
```

### 17.3 Loss Concentration Chart

특정 Hole / Distance / Situation의 손실 집중.

### 17.4 Priority Matrix

```text
Immediate
Development
Maintain
Monitor
```

과도한 그래프와 장식은 사용하지 않는다.

---

## 18. Player Report와 Coach Report

같은 Calculation Engine을 사용하되 마지막 해석 Layer를 다르게 한다.

### 18.1 Player Report

- 무엇이 일어났는가
- 무엇을 먼저 해야 하는가
- 다음 라운드에서 무엇을 확인할 것인가

### 18.2 Coach On-Course Lesson Report

Player Report에 다음을 추가한다.

```text
Coach Observation
Intervention During Round
Response after Intervention
Next Lesson Focus
Coach Name / Academy
```

코치 입력은 Voice → Structured Note 방식이 우선이다.

Coach Observation은 Raw Data를 덮어쓰지 않는다.

---

## 19. WhatsApp Output

WA 메시지는 PDF 전체를 복사하지 않는다.

기본 구성:

```text
[JGI ROUND PERFORMANCE]

Player: [PLAYER NAME]
Score: [SCORE] ([TO PAR])
Biggest Loss: [CATEGORY] [SG]
Today's Priority: [IMMEDIATE PRIORITY]
Development: [DEVELOPMENT PRIORITY]
Strength: [MAINTAIN STRENGTH]

Next Action:
[ONE ACTION]

Full Report: <PDF / Report Link>
```

### WA 원칙

- 핵심 5개 이하
- 행동 1개
- PDF 또는 Report Link 포함
- Sensitive State / WHOOP는 동의 없이 기본 메시지에 노출하지 않음

---

## 20. Player별 결과가 달라지는 이유

동일한 Report Template을 사용해도 결과는 Player마다 달라야 한다.

입력 차이:

- 성별
- Handicap
- Benchmark
- Club Distance
- Miss Profile
- Course
- Tee
- Shot Result
- Course Risk
- Player State
- Personal Baseline

예:

### Player A

```text
Fairway Hit High
Distance Low
OTT Negative
→ Development Priority: Tee Shot Distance
```

### Player B

```text
Distance High
Penalty High
OTT Negative
→ Immediate Priority: Tee Shot Risk Control
```

### Player C

```text
GIR Low
APP Positive
Good Miss High
→ Maintain: Approach Decision / Miss Quality
```

### Player D

```text
Total Putts Normal
Short-Putt SG Highly Negative
→ Immediate Priority: Short-Putt Conversion
```

---

## 21. Report Output Schema

권장 구조:

```json
{
  "report_id": "",
  "report_version": "JGI_FINAL_ROUND_REPORT_V1_0",
  "player": {},
  "round": {},
  "benchmark": {},
  "data_quality": {},
  "traditional_metrics": {},
  "result_quality": {},
  "performance_value": {
    "sg_total": null,
    "sg_ott": null,
    "sg_app": null,
    "sg_arg": null,
    "sg_putt": null,
    "penalty_adjustment": null
  },
  "diagnoses": [],
  "hidden_patterns": [],
  "priorities": {
    "biggest_category_loss": null,
    "worst_single_event": null,
    "immediate_scoring_priority": null,
    "development_priority": null,
    "maintain_strength": [],
    "secondary_monitor": []
  },
  "action_plan": {},
  "next_round_verification": [],
  "claim_provenance": [],
  "coach_layer": null,
  "distribution": {
    "pdf": null,
    "image": null,
    "whatsapp_summary": null
  }
}
```

---

## 22. Missing / Low-Confidence Report 표현

### 데이터 부족

```text
현재 데이터만으로 원인을 확정할 수 없습니다.
```

### Benchmark LOW

```text
본 SG는 Modeled Benchmark 기준이며 절대적 실력평가보다 손실 구간 탐지에 사용합니다.
```

### GPS 불확실

```text
해당 Shot의 Position Quality가 낮아 거리 및 SG 해석의 Confidence를 낮춥니다.
```

### 한 라운드

```text
Single-Round Observation이며 반복 패턴으로 확정하지 않습니다.
```

---

## 23. 금지 규칙

다음은 하지 않는다.

- 가장 낮은 SG를 무조건 연습 1순위로 지정
- Fairway Hit만 보고 Tee Shot을 성공으로 확정
- GIR만 보고 Approach 능력을 평가
- Up & Down만 보고 Short Game을 평가
- Total Putts만 보고 Putting을 평가
- GPS Observed Distance를 Carry로 표시
- State와 Miss의 인과를 단정
- Benchmark Quality를 숨김
- Missing Metric을 0으로 표시
- LLM이 Raw Data나 SG를 새로 생성
- 한 라운드 결과를 장기 Pattern으로 확정

---

## 24. Field Validation Checklist

### Data

- [ ] Score 일치
- [ ] Shot / Putt / Penalty 합계 일치
- [ ] Benchmark 고정
- [ ] Position / Lie Quality 확인
- [ ] Shot Purpose 확인

### Metrics

- [ ] Fairway 분모 확인
- [ ] Driver-only 지표 분리
- [ ] Par 3 Green Hit 분리
- [ ] GPS Distance / Carry 명칭 분리
- [ ] Green Attack / Lay-up 분리
- [ ] Short Game / Conversion Putting 분리

### Priorities

- [ ] Biggest Loss와 Immediate Priority 구분
- [ ] Development Priority 존재
- [ ] Maintain Strength 존재
- [ ] 행동이 구체적 상황 단위
- [ ] Next-Round Verification 존재

### Language

- [ ] 사실 / 계산 / 해석 / 제안 구분
- [ ] 인과 단정 없음
- [ ] Confidence 표시
- [ ] 전문 스포츠 분석팀 Tone

---

## 25. Version Policy

### V1.0

- Single-Round Final Report
- Traditional Result + Result Quality + SG
- Hidden Pattern
- Immediate / Development / Maintain 분리
- Player / Coach Output
- PDF / WA 구조

### V1.x

- 실제 Field Validation에 따른 Threshold 보완
- Priority Weight 보정
- Data Quality Standard 연결
- Coach Intervention 분석 강화

### V2

- Personal Baseline 자동 비교
- Multi-Round Pattern Scoring
- Course × Distance × State Risk Model
- Predictive Priority

---

## 26. 공식 정의

> **JGI Final Round Performance Report는 Traditional Result, Result Quality, Strokes Gained, Course Context, Player State, Data Quality를 함께 분석하여 Biggest Loss, Immediate Scoring Priority, Development Priority, Maintain Strength, Next Action을 분리해 제시하는 Player-specific Performance Report다. 동일 Template을 사용하되 결론은 Player의 실제 Raw Data, Benchmark, Context, Confidence에 따라 달라져야 한다.**

---

## APPENDIX A — 기본 전문 문장 구조

### Executive Summary

```text
이번 라운드의 가장 큰 누적 SG 손실은 [CATEGORY]에서 발생했다.
그러나 [TRADITIONAL METRIC]과 [RESULT QUALITY]를 분리하면, 주된 개발 과제는 [DIAGNOSIS]로 판단된다.
오늘 스코어에 가장 직접적인 손실은 [SPECIFIC SITUATION]에서 집중됐다.
[STRENGTH]는 유지해야 할 Performance Strength로 확인됐다.
```

### Immediate Priority

```text
[Situation]에서 [N]회, 총 [SG]의 손실이 집중됐다.
즉시 교정 가능성과 손실 집중도를 고려하여 다음 훈련의 최우선 과제로 지정한다.
```

### Development Priority

```text
[Traditional Strength]는 유지할 가치가 높다.
향후 더 낮은 스코어 수준으로 진입하기 위해서는 이를 훼손하지 않으면서 [Development Area]를 향상시켜야 한다.
```

### Confidence

```text
본 결과는 [Benchmark] 기준이며 Benchmark Quality는 [LEVEL]이다.
따라서 절대적 실력평가보다 손실 구간 탐지와 다음 검증 과제 설정에 사용한다.
```

---

## APPENDIX B — JGI Agent Source Instructions

```text
1. Use only supplied JGI data as factual evidence.
2. Do not invent missing shots, distances, causes, benchmark values, or Player State.
3. Separate FACT, CALCULATION, DIAGNOSIS, and RECOMMENDATION.
4. Do not select the lowest SG category automatically as Today's Priority.
5. Compare Traditional Result, Result Quality, and SG Value.
6. Identify hidden performance patterns.
7. Produce exactly one Immediate Scoring Priority.
8. Produce exactly one Development Priority when evidence exists.
9. Identify at least one Maintain Strength when evidence exists.
10. End with one Next Action and measurable Next-Round Verification.
11. State sample size and Confidence.
12. Never claim psychological causality without validated repeated evidence.
```

---

이 문서는 JGI Player의 Final Round Performance Report, Coach On-Course Lesson Report, PDF, WhatsApp Summary, JGI Agent 설명의 공식 Source 문서로 사용한다.
