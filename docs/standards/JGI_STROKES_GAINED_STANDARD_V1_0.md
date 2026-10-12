# JGI STROKES GAINED STANDARD V1

**Project:** JGI Player  
**Document Type:** Performance Metric / Data & Calculation Standard  
**Version:** V1.0  
**Defined:** 2026-10-01  
**Status:** Active Design Standard  
**Review Policy:** 실제 필드 Shot Data와 Benchmark 검증 후 V2 재검증

---

## 1. 목적

JGI Player에서 Strokes Gained의 목적은 단순히 스코어를 잘 쳤는지 못 쳤는지를 보여주는 것이 아니다.

JGI가 알고자 하는 것은 각 Shot이:

**Shot 전의 기대 타수(Expected Strokes)**

에서

**Shot 후의 기대 타수(Expected Strokes)**

를 얼마나 변화시켰는가이다.

즉 Strokes Gained는 각 Shot의 경기 가치(Shot Value)를 수치화한다.

JGI에서는 이를 다음 흐름에 사용한다.

**Shot SG → Hole Review → Live Round Review → Final Round Review → Personal Baseline / Context Pattern**

Strokes Gained는 Player State와 별개의 Result Metric이며, JGI는 두 데이터를 이후 연결하여 관계를 분석한다.

---

## 2. 핵심 정의

Strokes Gained는 특정 위치에서 Hole Out까지 필요한 평균 기대 타수를 기준으로 한 Shot의 가치다.

Benchmark function을 다음처럼 정의한다.

`J(distance, lie)`

여기서:

- `distance` = 현재 Ball 위치에서 실제 Hole/Cup까지의 거리
- `lie` = 현재 Ball의 상태 또는 위치 유형
- `J` = 해당 Benchmark Player가 그 위치에서 Hole Out까지 필요로 하는 평균 타수

일반 Shot의 기본 공식은 다음과 같다.

`SG Shot = Expected Strokes Before - 1 - Expected Strokes After`

즉:

`sg_shot = J(start_distance, start_lie) - 1 - J(end_distance, end_lie)`

Positive SG는 Benchmark보다 좋은 결과를 만든 Shot을 의미하고, Negative SG는 Benchmark보다 기대 타수를 더 많이 남긴 Shot을 의미한다.

이 공식은 Mark Broadie의 Strokes Gained 기본 구조를 JGI Raw Data Architecture에 적용한 것이다.

---

## 3. Hole Out Shot

Shot이 Hole에 들어간 경우:

`Expected Strokes After = 0`

으로 처리한다.

따라서:

`sg_shot = J(start_distance, start_lie) - 1`

예를 들어 Benchmark가 현재 위치에서 평균 1.40타가 필요하고 Player가 한 번에 Hole Out하면:

`1.40 - 1 = +0.40 SG`

가 된다.

---

## 4. Penalty가 포함된 기본 공식

Penalty가 발생하는 Shot은 단순히 `-1 stroke` 공식으로 계산하면 안 된다.

JGI는 다음 일반식을 사용한다.

`SG Shot = Expected Before - Transition Strokes - Expected After`

여기서:

`Transition Strokes = 1 Physical Shot + Penalty Strokes caused by that Shot`

즉:

`sg_shot = J(start) - (1 + penalty_strokes) - J(next_playable_state)`

이 방식으로 OB, Lost Ball, Penalty Area, Unplayable Ball 등을 동일한 구조에서 처리할 수 있다.

---

## 5. OB / Lost Ball / Stroke-and-Distance

Stroke-and-Distance 상황에서는 일반적으로:

- 실제 Shot = 1타
- Penalty = 1타
- 다음 Playable State = 원래 위치 또는 Rule에 의해 다시 플레이하는 위치

가 된다.

따라서 같은 위치에서 다시 치는 경우 이론적으로 해당 Shot의 손실은 약:

`-2.0 SG`

가 된다.

JGI는 OB 자체를 별도의 임의 감점 숫자로 처리하지 않는다.

반드시:

**Expected Before + 실제 소모 타수 + Next Playable State**

로 계산한다.

---

## 6. Penalty Area / Hazard

Penalty Area로 인해 1벌타 후 Drop하는 경우:

`Transition Strokes = 2`

으로 계산한다.

그리고 `Expected After`는 Hazard 안의 Ball 위치가 아니라 **Penalty 적용 후 실제 다음 Shot을 플레이하는 위치**를 사용한다.

예:

`Start Fairway → Water → 1 Penalty → Drop Position`

이면:

`SG = J(Start Fairway) - 2 - J(Drop Position)`

으로 계산한다.

Player가 Penalty Area 안의 Ball을 벌타 없이 그대로 플레이하는 경우에는 실제 Playable Lie를 저장하고 일반 Shot으로 처리한다.

---

## 7. 기타 Penalty

Penalty는 두 종류로 구분한다.

### Shot-Caused Penalty

예:

- OB
- Lost Ball
- Penalty Area
- Unplayable Ball

가능하면 해당 원인 Shot에 연결한다.

이 Penalty는 해당 Shot의 SG Category에 포함한다.

### Administrative / Procedural Penalty

특정 Shot에 합리적으로 귀속할 수 없는 Penalty는:

`sg_penalty_adjustment`

로 별도 저장한다.

이 경우 Round Total은:

`SG Total = SG OTT + SG APP + SG ARG + SG PUTT + SG Penalty Adjustment`

으로 재조정한다.

JGI는 원인을 알 수 없는 Penalty를 임의로 특정 Shot Category에 배분하지 않는다.

---

## 8. JGI Strokes Gained 4개 기본 Category

JGI V1은 다음 4개 SG Category를 사용한다.

1. **Off-the-Tee — OTT**
2. **Approach — APP**
3. **Around-the-Green — ARG**
4. **Putting — PUTT**

그리고:

`Tee-to-Green = OTT + APP + ARG`

로 계산한다.

`SG Total`은 4개 Category와 필요한 Penalty Adjustment를 합산한다.

PGA TOUR 역시 현재 Strokes Gained를 Off-the-Tee, Approach-the-Green, Around-the-Green, Putting의 네 주요 Category로 구분한다.

---

## 9. SG Off-the-Tee — OTT

JGI V1에서 SG OTT는:

**Par 4 또는 Par 5의 Tee Shot**

으로 정의한다.

조건 예:

`shot_sequence = 1`

`start_lie = TEE`

`hole_par IN (4,5)`

Club은 Driver일 필요가 없다.

3 Wood, Hybrid, Iron을 사용했더라도 Par 4/5 Tee Shot이면 SG OTT에 포함한다.

Par 3 Tee Shot은 SG OTT가 아니다.

---

## 10. SG Approach — APP

SG Approach는 다음 조건의 Shot을 의미한다.

- SG OTT가 아님
- Putting이 아님
- Around-the-Green이 아님
- Green을 향한 공격 또는 진행 Shot

Par 3 Tee Shot은 SG Approach에 포함한다.

또한 Par 4/5에서 Tee Shot 이후 발생한 Fairway, Rough, Bunker, Recovery 등의 Shot 중 Around-the-Green 기준 밖에 있는 Shot은 기본적으로 APP로 분류한다.

따라서 SG Approach는 `shot_sequence = 2`와 동일하지 않다.

---

## 11. SG Around-the-Green — ARG

JGI V1은 Around-the-Green 분류 기준으로:

**Green Edge로부터 30 yards 이내**

를 사용한다.

30 yards는:

**27.432 meters**

이다.

기본 조건은:

- Ball이 Putting Green 위에 있지 않음
- Ball 위치에서 Green Edge까지의 최소 거리가 27.432m 이하
- Short Game / Recovery 성격의 Shot

이다.

예:

- Chip
- Pitch
- Greenside Bunker
- Short-side Recovery
- Fringe 밖에서의 Short Game Shot

Green Center 또는 Pin까지의 거리만으로 ARG 여부를 결정하지 않는다.

가능하면 Course Green Polygon 또는 Green Boundary에서 Ball 위치까지의 최소 거리를 사용한다.

---

## 12. SG Putting — PUTT

Ball의 Start Lie가 실제 Putting Green이면 SG Putting으로 분류한다.

기본 조건:

`start_lie = GREEN`

Putting SG에서는 특히 **실제 Cup까지의 거리**가 중요하다.

Green Center까지의 거리로 Putting SG를 계산해서는 안 된다.

JGI에서 실제 Hole Location이 확보되지 않은 경우 정확한 SG Putting 값으로 표시하지 않는다.

---

## 13. Shot Group과 SG Category는 같은 개념이 아니다

JGI State Sampling Standard의:

- `shot_group`
- `stroke_kind`
- `shot_sequence`

와 Strokes Gained의:

- `sg_category`

는 별도로 저장한다.

특히:

**Second Shot ≠ SG Approach**

이다.

예:

| Situation | shot_group | shot_sequence | stroke_kind | sg_category |
|---|---|---:|---|---|
| Par 4 Driver Tee Shot | Tee | 1 | Driver Tee | OTT |
| Par 3 Iron Tee Shot | Tee | 1 | Iron Tee | APP |
| Par 5 Fairway 2nd Shot | Second | 2 | Fairway | APP |
| Par 4 2nd Shot, 20m Chip | Second | 2 | Chip | ARG |
| 3rd Shot, 160m Recovery | Other / Actual Sequence | 3 | Recovery | APP |
| First Putt | Putting | Green sequence 1 | First Putt | PUTT |

따라서 JGI는 Sampling Architecture와 Performance Category를 절대로 하나의 필드로 합치지 않는다.

---

## 14. SG Category 결정 우선순위

JGI V1은 Category 충돌을 방지하기 위해 다음 순서로 판단한다.

### 1. PUTT

`start_lie = GREEN`

이면 PUTT.

### 2. OTT

Green이 아니고:

`start_lie = TEE`

`shot_sequence = 1`

`hole_par = 4 or 5`

이면 OTT.

### 3. ARG

PUTT/OTT가 아니고 Green Edge 27.432m 이내의 Around-Green Shot이면 ARG.

### 4. APP

나머지 정상적인 Green 진행 / Attack / Recovery Shot은 APP.

분류가 불가능하면 임의로 추정하지 않고:

`sg_category = UNKNOWN`

으로 남긴다.

---

## 15. Raw Lie와 SG Benchmark Lie를 분리한다

JGI는 실제 Raw Data의 Lie를 최대한 상세하게 저장한다.

예:

- TEE
- FAIRWAY
- FIRST_CUT
- ROUGH
- DEEP_ROUGH
- FAIRWAY_BUNKER
- GREENSIDE_BUNKER
- RECOVERY
- PENALTY_AREA_PLAYABLE
- FRINGE
- GREEN
- OTHER

하지만 SG Benchmark가 동일한 수준의 세분화 데이터를 가지고 있지 않을 수 있다.

따라서 별도로:

`sg_lie_class`

를 둔다.

V1의 기본 Normalized Class 후보는:

- TEE
- FAIRWAY
- ROUGH
- SAND
- RECOVERY
- GREEN

이다.

Raw Lie를 삭제하거나 덮어쓰지 않는다.

Benchmark 확정 후 Raw Lie → SG Lie Mapping Table을 Version 관리한다.

---

## 16. Start State와 End State

각 Shot의 SG 계산에는 최소한 두 상태가 필요하다.

### Start State

Shot 직전의:

- Ball Position
- Distance to Hole
- Lie

### End State

해당 Shot과 연결된 Rule Event가 끝난 뒤 다음 Shot을 플레이하게 되는:

- Next Ball Position
- Distance to Hole
- Lie

이다.

일반적으로 Shot N의 `End State`는 Shot N+1의 `Start State`와 연결된다.

이 구조는 GPS Shot Tracking에서 데이터 일관성을 유지하는 데 중요하다.

---

## 17. Distance to Target과 Distance to Hole을 분리한다

JGI State Sampling Standard에는:

`distance_to_target`

이 존재한다.

그러나 Strokes Gained 계산에는 별도의:

`distance_to_hole`

이 필요하다.

둘은 같은 값이 아닐 수 있다.

예:

Par 5에서 Lay-up Target까지 100m를 남기기 위해 Fairway의 특정 Landing Zone을 Target으로 설정할 수 있다.

이때:

`distance_to_target`

은 Player Decision 분석용이고,

`distance_to_hole`

은 SG 계산용이다.

두 값을 절대로 하나의 필드로 합치지 않는다.

---

## 18. Pin / Hole Location 기준

SG는 Ball에서 실제 Hole까지의 거리를 사용한다.

따라서 각 Round에는 가능하면:

- `pin_lat`
- `pin_lng`
- `pin_source`
- `pin_accuracy`

를 저장한다.

`pin_source` 예:

- COURSE_DAILY_PIN
- PLAYER_SET_PIN
- GPS_CAPTURED_PIN
- PROVIDER_ESTIMATE
- GREEN_CENTER_ESTIMATE
- UNKNOWN

Green Center를 Pin으로 임의 대체한 값은 정확한 SG와 동일하게 취급하지 않는다.

특히 Putting에서는 작은 거리 오차도 SG에 큰 영향을 줄 수 있다.

---

## 19. GPS Accuracy와 SG Quality

JGI는 계산값이 있다는 이유만으로 SG를 신뢰하지 않는다.

각 Shot에는 최소한 다음 품질 정보가 연결되어야 한다.

- `start_position_source`
- `end_position_source`
- `gps_accuracy_start_m`
- `gps_accuracy_end_m`
- `pin_source`
- `lie_source`
- `sg_quality`

`sg_quality`는 향후 다음과 같이 운영할 수 있다.

- HIGH
- MEDIUM
- LOW
- INVALID

정확한 기준값은 실제 필드 테스트 후 별도 Calibration으로 확정한다.

스마트폰 GPS 위치만으로 매우 짧은 Putt의 정확한 거리를 계산했다고 가정해서는 안 된다.

---

## 20. Course / Golf Intelligence Data의 역할

Golf Intelligence Course Data와 JGI Course Map은 SG 계산의 자동화에 사용한다.

가능하면 시스템이 자동 판단하는 항목:

- Tee 위치
- Fairway 여부
- Rough / Outside Fairway
- Bunker 여부
- Green 여부
- Green Boundary
- Hazard / Penalty Area
- Ball-to-Green Edge Distance
- Hole Number
- Hole Par
- Course / Tee Set

Player에게 GPS / Course Data로 알 수 있는 정보를 다시 입력시키지 않는 것이 기본 원칙이다.

단, GPS 또는 Course Polygon이 실제 Ball Lie와 다르면 Player가 수정할 수 있어야 한다.

이 경우:

- Auto Detected Value
- Player Corrected Value

를 모두 보존한다.

---

## 21. Benchmark는 SG 계산의 핵심 Source다

SG는 Benchmark 없이는 계산할 수 없다.

JGI Benchmark에는 최소한 다음이 필요하다.

- `benchmark_id`
- `benchmark_name`
- `benchmark_skill_level`
- `benchmark_source`
- `benchmark_version`
- `distance_unit`
- `lie_classes`
- `expected_strokes_table`
- `interpolation_method`
- `effective_date`

같은 Shot Raw Data라도 Benchmark가 바뀌면 SG 값이 달라질 수 있다.

따라서 SG 값에는 반드시 어떤 Benchmark Version으로 계산했는지를 저장한다.

---

## 22. V1 Benchmark 결정 상태

JGI는 초기에는 **하나의 명확한 Benchmark**를 사용한다.

이후 필요하면:

- Amateur Level
- Scratch
- Pro
- Tour

등으로 확장할 수 있다.

그러나 **JGI V1의 최초 Benchmark가 어떤 Population / Skill Level을 사용할지는 아직 확정되지 않았다.**

따라서 현재 공식 상태는:

`JGI_SG_BENCHMARK = PENDING`

이다.

Benchmark Source가 검증되기 전에는 실제 Player에게 임의의 SG 숫자를 생성하지 않는다.

---

## 23. Personal Baseline과 SG Benchmark는 다르다

JGI Personal Baseline은 Player 자신의 과거 경기 데이터다.

예:

- 최근 10 Round SG Approach 평균
- 150–180m Rough SG
- Back 9 SG Putting
- 특정 Club 사용 시 SG

하지만 이것을 Canonical Strokes Gained 계산의 Benchmark로 대체하지 않는다.

즉:

**SG Benchmark = 외부 또는 정의된 Reference Population**

**Personal Baseline = Player 자신의 과거 성능 비교 기준**

이다.

JGI는 둘을 함께 보여줄 수 있지만 같은 숫자로 취급하지 않는다.

---

## 24. 모든 Shot에 SG를 계산한다

Player State는 Sampling Shot에만 입력할 수 있지만 Strokes Gained는 가능한 한 **모든 유효 Shot**에 계산한다.

즉:

`State Sampling ≠ SG Sampling`

이다.

정상 Shot Tracking이 존재하고 SG 계산에 필요한 Start / End State가 확보되어 있다면 해당 Shot의 SG를 계산한다.

이 구조를 통해 State가 없는 Shot도 Performance 분석에 포함할 수 있다.

---

## 25. State Sampling과 SG Result를 섞지 않는다

System State Sampling 대상 Shot은 Shot Result가 나오기 전에 정해져야 한다.

따라서:

`SG가 크게 마이너스였기 때문에 State Sample로 선택`

하는 방식은 정상 Sampling Dataset에서는 사용하지 않는다.

이는 Result-Based Sampling Bias를 만들기 때문이다.

다만 큰 SG Loss, OB, 3-Putt 등의 결과는:

`Special Event`

로 별도 기록하여 Live Review 또는 Final Review에서 사용할 수 있다.

---

## 26. JGI Live Round Review에서의 SG

Live Round Review는 Player가 아직 Round 중일 때 행동을 바꿀 수 있도록 해야 한다.

SG는 다음 수준으로 사용한다.

예:

**After 9 Holes**

- SG OTT +0.4
- SG APP -1.3
- SG ARG +0.1
- SG PUTT -0.2

그리고 단순 숫자만 보여주지 않고 Context와 함께 본다.

예:

`Approach -1.3`

→ 손실의 대부분이 150–180m에서 발생

→ Rough에서 우측 Miss 반복

→ 다음 Hole의 유사 상황에서 Target / Club / Risk 선택을 확인

JGI는 SG 숫자만으로 Swing Cause를 단정하지 않는다.

---

## 27. Hole Review에서의 SG

Hole Review에서는 각 Shot을 다음처럼 연결할 수 있다.

`Shot 1 → SG +0.20`

`Shot 2 → SG -0.45`

`Shot 3 → SG +0.10`

`Putt 1 → SG -0.18`

Hole Total:

`-0.33 SG`

이를 Score만 보는 것과 분리한다.

예를 들어 Bogey가 나왔더라도 어떤 Shot이 실제로 가장 큰 기대타수 손실을 만들었는지를 확인할 수 있다.

---

## 28. Final Round Review에서의 SG

Final Round Review에는 최소한 다음을 제공한다.

- SG Total
- SG OTT
- SG APP
- SG ARG
- SG PUTT
- Penalty SG / Adjustment
- Best / Worst Shot Value
- Distance Band SG
- Lie-based SG
- Club-based SG
- Front / Back SG
- 6 Round Phase SG

단, Sample 수가 너무 적은 세부 구간은 과도하게 해석하지 않는다.

필요하면 `sample_count`와 `confidence`를 함께 표시한다.

---

## 29. Personal Intelligence와 SG

JGI는 약 10 Round부터 Personal Baseline을 만들고, 20+ Round부터 Context Pattern을 본다.

SG는 다음 분석에 사용할 수 있다.

예:

**Distance × Lie × Club → SG Result**

**Course Design × Distance × Player State → Miss Risk / SG Loss**

**Round Phase × State → SG Change**

**Penalty Situation → Expected Loss**

그러나 관계가 관찰되었다고 해서 곧바로 원인으로 단정하지 않는다.

JGI는:

- 반복 횟수
- Sample Size
- Context Coverage
- Confidence

를 함께 본다.

---

## 30. JGI Raw Data 최소 SG 필드

각 Shot에는 SG 계산 또는 재계산을 위해 최소한 다음 Raw Data를 연결한다.

### Identity

- `round_id`
- `hole_id`
- `hole_number`
- `shot_id`
- `shot_sequence`

### Hole

- `hole_par`
- `tee_set`

### Shot Classification

- `shot_group`
- `stroke_kind`
- `shot_purpose`
- `sg_category`

### Start State

- `start_lat`
- `start_lng`
- `start_lie`
- `start_sg_lie_class`
- `start_distance_to_hole`
- `distance_to_target`

### End / Next Playable State

- `end_lat`
- `end_lng`
- `end_lie`
- `end_sg_lie_class`
- `end_distance_to_hole`

### Green / Pin

- `pin_lat`
- `pin_lng`
- `pin_source`
- `distance_to_green_edge`

### Rules / Penalty

- `penalty_type`
- `penalty_strokes`
- `relief_type`
- `holed`

### SG Calculation

- `benchmark_id`
- `benchmark_version`
- `expected_strokes_before`
- `expected_strokes_after`
- `transition_strokes`
- `sg_shot`
- `sg_penalty_adjustment`
- `sg_quality`
- `sg_valid`

### Audit

- `position_source`
- `lie_source`
- `player_corrected`
- `calculation_version`
- `calculated_at`

---

## 31. SG 계산값보다 Raw Data를 우선 보존한다

Strokes Gained Benchmark와 계산 로직은 향후 바뀔 수 있다.

따라서 DB에는 최종 SG 숫자만 저장해서는 안 된다.

반드시:

**Raw Shot State + Benchmark Version + Calculation Version**

을 보존한다.

이 구조가 있어야 향후 새로운 Benchmark 또는 개선된 알고리즘이 생겼을 때 과거 Round 전체를 재계산할 수 있다.

---

## 32. Calculation Version

V1 기준 계산 버전은:

`JGI_SG_CALC_V1`

로 정의한다.

Benchmark는 별도 Version을 사용한다.

예:

`calculation_version = JGI_SG_CALC_V1`

`benchmark_version = [PENDING]`

계산 방식과 Benchmark Data Version을 하나의 값으로 합치지 않는다.

---

## 33. Missing Data 정책

SG 필수 데이터가 없으면 임의로 0을 넣지 않는다.

예:

- Start Position 없음
- End Position 없음
- Lie 불명
- Hole Location 불명
- Penalty 처리 불명
- Benchmark 없음

이면:

`sg_valid = false`

`sg_shot = null`

로 처리한다.

UI에서 `0.00 SG`로 보여주면 안 된다.

0.00은 실제 계산 결과가 정확히 Benchmark 수준이라는 뜻이므로 Missing Data와 의미가 완전히 다르다.

---

## 34. Estimated SG 정책

일부 위치가 추정값일 경우 Exact SG와 구분한다.

예:

`sg_quality = LOW`

또는

`sg_estimated = true`

로 표시한다.

특히 다음 상황은 주의한다.

- Pin을 Green Center로 대체
- Ball 위치를 Cart GPS로 대체
- Bunker / Rough Lie 자동분류 Confidence가 낮음
- Putting 거리의 GPS 오차가 큼

Estimated 값을 Exact 데이터와 동일한 Confidence로 Personal Intelligence 학습에 사용하지 않는다.

---

## 35. Putting Data Quality는 별도 검증 대상이다

Putting은 수 미터 이하의 거리 차이가 SG에 직접 영향을 준다.

따라서 일반 Smartphone GPS만으로 Putting Start Distance와 Hole Position을 정확하게 측정할 수 있다고 전제하지 않는다.

JGI V1 필드 테스트에서는 다음을 별도 검증해야 한다.

- 실제 Cup 위치 획득 방법
- First Putt 위치 정확도
- Short Putt 거리 정확도
- Phone GPS 오차
- Player 입력 부담

SG Putting이 충분한 품질로 확보되지 않으면 다른 Category보다 늦게 활성화할 수 있다.

---

## 36. Course Difficulty와 Field Adjustment

PGA TOUR의 공식 Strokes Gained 시스템에는 Tournament Field와 Course/Round Difficulty를 고려하는 고급 보정 개념이 존재한다.

JGI V1은 이를 그대로 복제한다고 가정하지 않는다.

JGI V1의 우선순위는:

1. 정확한 Shot Raw Data
2. 검증된 Expected Strokes Benchmark
3. 일관된 Category Classification
4. Penalty 처리
5. GPS / Lie / Pin Data Quality

이다.

Course Difficulty Adjustment와 Field Adjustment는 이후 충분한 데이터와 필요성이 확인된 뒤 확장한다.

---

## 37. PGA TOUR SG와 JGI SG를 동일하다고 표시하지 않는다

JGI가 PGA TOUR와 동일한 4개 Category 명칭을 사용하더라도:

- Benchmark Population
- Course Adjustment
- Field Adjustment
- Shot Position Accuracy
- Recovery Classification
- Pin Data

가 다를 수 있다.

따라서 JGI 계산값은:

**JGI Strokes Gained vs [Benchmark Name]**

형태로 명확히 표시한다.

공식 PGA TOUR ShotLink SG와 동일한 값이라고 주장하지 않는다.

---

## 38. V1에서 하지 않는 것

JGI SG V1은 다음을 하지 않는다.

- Benchmark가 없는데 SG 숫자를 임의 생성
- Score만 보고 Category SG를 역산
- Second Shot을 자동으로 SG Approach라고 가정
- Par 3 Tee Shot을 SG OTT로 분류
- Green Center를 실제 Cup으로 간주하여 정확한 Putting SG라고 표시
- OB / Hazard를 고정 임의 감점값으로 처리
- Missing Data를 0.00 SG로 처리
- Player Personal Baseline을 Canonical SG Benchmark와 혼합
- 한두 Round의 SG 결과만으로 Player의 원인 또는 능력을 단정
- SG Loss가 큰 Shot만 State Sampling하여 Primary Dataset에 Result Bias 생성

---

## 39. JGI에서 SG가 답해야 하는 질문

JGI Strokes Gained의 목적은 단순 Ranking이 아니다.

JGI는 다음 질문에 답할 수 있어야 한다.

**오늘 어디에서 타수를 얻고 잃고 있는가?**

**어떤 Distance / Lie / Club / Course Context에서 손실이 반복되는가?**

**오늘의 문제는 평소 Personal Baseline과 다른가?**

**후반에 특정 SG Category가 반복적으로 떨어지는가?**

**특정 Player State와 특정 SG Loss가 충분한 Sample에서 함께 반복되는가?**

그리고 최종적으로:

**다음 Hole에서 지금 바꿀 수 있는 행동 1개는 무엇인가?**

로 연결한다.

---

## 40. V1 핵심 원칙

- **SG는 Shot Value다.**
- **SG = Expected Before - Actual Transition Strokes - Expected After**
- **Benchmark가 없으면 SG도 없다.**
- **SG Benchmark와 Personal Baseline은 분리한다.**
- **OTT / APP / ARG / PUTT 4개 Category를 사용한다.**
- **Par 3 Tee Shot = APP**
- **Par 4/5 Tee Shot = OTT**
- **ARG 기준 = Green Edge 30 yards / 27.432m 이내**
- **Putting은 실제 Cup Distance가 핵심이다.**
- **Second Shot ≠ SG Approach**
- **Shot Group / Stroke Kind / Shot Sequence / SG Category를 각각 저장한다.**
- **Penalty는 실제 소모타수와 Next Playable State로 계산한다.**
- **SG는 가능한 모든 유효 Shot에 계산한다.**
- **Player State는 Sampling된 Shot에만 필요하다.**
- **Raw Data를 보존하여 향후 Benchmark 변경 시 재계산 가능해야 한다.**
- **Missing SG ≠ 0.00 SG**
- **JGI SG를 공식 PGA TOUR ShotLink SG와 동일하다고 주장하지 않는다.**

---

## 41. V1 미확정 사항

다음 항목은 별도 결정이 필요하다.

### A. 최초 JGI SG Benchmark

현재 상태:

`PENDING`

결정 필요:

- Benchmark Population
- Skill Level
- Source Dataset
- Distance / Lie Table
- Licensing / Usage Rights

### B. Putting Position Capture

결정 필요:

- Actual Pin Capture 방식
- Putt Start Position 방식
- Short Putt 처리

### C. GPS Quality Threshold

실제 필드 테스트 후:

- HIGH / MEDIUM / LOW / INVALID 기준

을 확정한다.

### D. Recovery Lie Mapping

실제 데이터와 Benchmark 구조를 확인한 뒤:

- RECOVERY
- DEEP_ROUGH
- PENALTY_AREA_PLAYABLE
- OTHER

의 SG Lie Mapping을 확정한다.

---

## 42. 외부 개념 참조

JGI SG V1의 기본 수학 구조와 Strokes Gained 개념은 다음 자료를 참고한다.

- Mark Broadie, **Assessing Golfer Performance on the PGA TOUR**, Interfaces, 2012.
- Mark Broadie, **Every Shot Counts**, 2014.
- PGA TOUR Strokes Gained category structure: Off-the-Tee / Approach / Around-the-Green / Putting.

다만 JGI의 Raw Data Architecture, Sampling 분리, GPS/Course Context 연결, Penalty 처리, Personal Baseline 연결 및 Data Quality 정책은 JGI Player 운영 기준으로 별도 정의한다.

---

## 43. JGI Strokes Gained 공식 정의

> **JGI Strokes Gained는 각 Shot의 시작 위치와 Shot 이후의 다음 Playable State에서 Benchmark가 필요로 하는 Expected Strokes 차이에서 실제로 소모된 Shot 및 Penalty Strokes를 차감하여 계산한다. JGI는 OTT, APP, ARG, PUTT의 4개 Category를 사용하지만 State Sampling의 shot_group 또는 실제 shot_sequence와 SG Category를 동일시하지 않는다. 모든 SG 계산은 Raw GPS/Position, Lie, Distance to Hole, Penalty Event, Benchmark Version과 연결하며, Missing 또는 낮은 품질의 데이터를 임의의 0.00 SG로 대체하지 않는다. Personal Baseline은 SG Benchmark와 별도로 유지하며, JGI는 SG를 Hole Review, Live Round Review, Final Round Review 및 장기적인 Player Context Pattern 분석에 사용한다.**

---

이 문서는 JGI Player의 Strokes Gained 공식 V1 기준 원본으로 사용한다.

향후 Benchmark Source와 Putting Capture 방식이 확정되면 V1.x Revision으로 반영하고, 실제 필드 데이터가 충분히 축적된 후 V2에서 재검증한다.
