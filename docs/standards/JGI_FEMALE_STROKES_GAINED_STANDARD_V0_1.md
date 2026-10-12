# JGI FEMALE STROKES GAINED STANDARD V0.1

**Project:** JGI Player  
**Document Type:** Female Performance Metric / Benchmark Extension Standard  
**Version:** V0.1  
**Defined:** 2026-10-07  
**Status:** Experimental / Field-Test Benchmark  
**Parent Standard:** `JGI_STROKES_GAINED_STANDARD_V1_0.md`  
**Implementation Profile:** `JGI_FEMALE_SG_V0_1_2026-10-07`  
**Review Policy:** 실제 Female Player Shot Data, 외부 공개 여성 데이터, 필드 테스트 결과를 이용해 거리·Lie별 Expected Strokes Curve를 재검증한 뒤 V1.0 승격 여부를 결정한다.

---

## 1. 목적

JGI Player의 Female Strokes Gained Standard는 여성 Player의 Shot Value를 남성 Benchmark와 분리하여 평가하기 위한 기준이다.

기존 남성 PGA TOUR / Male Scratch 기반 Expected Strokes를 여성 Player에게 그대로 적용하면 특히:

- Tee Shot
- Long Approach
- Mid / Long Iron
- Fairway / Rough 장거리 Shot

에서 여성 Player의 성능이 불필요하게 낮게 평가될 수 있다.

JGI는 여성 Player를 남성 Player와 동일한 기대타수표로 강제 비교하지 않는다.

Female SG의 목적은:

**여성 Player의 실제 경기 난도에 더 적합한 Expected Strokes Benchmark를 사용하여 Shot Value를 계산하는 것**

이다.

---

## 2. Parent Standard와의 관계

이 문서는 `JGI_STROKES_GAINED_STANDARD_V1_0.md`의 계산 원칙을 그대로 상속한다.

따라서 다음은 변경하지 않는다.

- SG 기본 공식
- Penalty 처리
- OTT / APP / ARG / PUTT Category
- Par 3 Tee Shot = APP
- Par 4/5 Tee Shot = OTT
- ARG = Green Edge 30 yards / 27.432m 이내
- Start State / End State
- Distance to Target과 Distance to Hole 분리
- Raw Data 우선 보존
- Missing SG ≠ 0.00 SG
- Benchmark Version 저장
- Personal Baseline과 Canonical SG Benchmark 분리

Female Standard에서 달라지는 것은:

**Expected Strokes Benchmark Population과 Lookup Table**

이다.

---

## 3. Female Benchmark가 별도로 필요한 이유

SwingU는 2024년 Female Strokes Gained Model을 공개하면서, 이전에는 여성 Player도 Male Scratch Golfer와 비교되었고 이것이 Driving과 Approach 평가를 왜곡할 수 있다고 설명했다.

SwingU는:

- Scratch Female Player들의 실제 라운드를 별도로 분석
- Female Strokes Gained Model 생성
- Female Target Handicap Data 재구성
- 기존 여성 라운드도 새 Female Model로 재계산

하는 구조를 적용했다고 공개했다.

JGI도 같은 원칙을 따른다.

즉:

**Male Benchmark ≠ Female Benchmark**

이며, 동일 Shot Raw Data라도 Benchmark Population이 바뀌면 SG 값은 달라질 수 있다.

---

## 4. V0.1 Benchmark Identity

현재 Female V0.1의 공식 Identity는 다음과 같다.

```text
benchmark_sex        = FEMALE
benchmark_level      = SCRATCH
benchmark_population = FEMALE_SCRATCH_AMATEUR
benchmark_type       = MODELED_PUBLIC_CALIBRATED
benchmark_source     = PUBLIC_CALIBRATED
benchmark_version    = JGI_FEMALE_SG_V0_1_2026-10-07
benchmark_quality    = LOW
```

현재 활성화 범위:

**Female Scratch Amateur**

이다.

아직 다음은 공식 Benchmark로 활성화하지 않는다.

- LPGA TOUR
- Female HCP 5
- Female HCP 10
- Female HCP 15
- Female HCP 20
- Female HCP 25

이들은 별도 데이터 검증 후 추가한다.

---

## 5. Benchmark Source Basis

Female V0.1은 하나의 공식 여성 Expected-Strokes 원본표를 복사한 것이 아니다.

공개적으로 확인 가능한 여러 여성 경기 데이터와 기존 JGI SG 구조를 결합한:

**MODELED_PUBLIC_CALIBRATED**

Benchmark다.

주요 공개 근거:

### A. SwingU Female Strokes Gained Model

SwingU는 Scratch Female Player들의 실제 Round Data를 별도로 분석해 여성 전용 Strokes Gained Model을 구축했다고 공개했다.

Source:

`https://clubhouse.swingu.com/press/swingu-releases-the-first-female-strokes-gained-model-for-all-handicaps/`

---

### B. Shot Scope / Women & Golf — Female Approach Data

Shot Scope의 여성 데이터 분석은 약 2.5 million shots / 26,000+ women’s rounds를 기반으로 한다.

Female Scratch Approach 공개 Anchor 예:

- 75–100 yards → 약 32 ft proximity
- 100–125 yards → 약 42 ft proximity
- 125–150 yards → 약 60 ft proximity

Source:

`https://womenandgolf.com/news-and-features/womens-golf-data-driving-distance-approach-play/`

---

### C. Shot Scope / Women & Golf — Female Short Game / Putting Data

공개 Female Scratch Anchor 예:

- 10 yards 이내 Up & Down ≈ 61%
- 20–30 yards Up & Down ≈ 39%
- 3–6 ft Putting Make ≈ 70%

Source:

`https://womenandgolf.com/news-and-features/womens-golf-data-short-game-putting/`

---

### D. USGA Women Par Distance Guidance

USGA Rules of Handicapping의 Par Guideline은 Women과 Men의 Hole Length Range를 별도로 정의한다.

Women:

- Par 3 → Up to 220 yards
- Par 4 → 200–420 yards
- Par 5 → 370–600 yards
- Par 6 → 570 yards and up

Source:

`https://www.usga.org/content/dam/usga/pdf/2024-revision/2024-Rules-of-Handicapping-USGA.pdf`

이 자료는 Female Tee Curve의 거리 난도 Calibration 참고값으로만 사용하며, 자체적으로 Expected Strokes Table을 제공하는 자료는 아니다.

---

## 6. SG 기본 공식

Female Benchmark에서도 SG 계산 공식은 동일하다.

일반 Shot:

`SG Shot = Expected Before - 1 - Expected After`

즉:

`sg_shot = J_female(start_distance, start_lie) - 1 - J_female(end_distance, end_lie)`

Penalty 포함:

`sg_shot = J_female(start) - (1 + penalty_strokes) - J_female(next_playable_state)`

Hole Out:

`sg_shot = J_female(start) - 1`

Female Standard는 계산 공식을 바꾸지 않는다.

**Benchmark Function만 Female-specific으로 교체한다.**

---

## 7. Female Benchmark Function

Female V0.1의 Benchmark Function을:

`J_female(distance, lie)`

로 정의한다.

여기서:

- `distance` = Ball에서 실제 Hole / Cup까지의 거리
- `lie` = SG normalized lie class
- `J_female` = Female Scratch Amateur가 해당 위치에서 Hole Out까지 필요로 하는 모델 Expected Strokes

이다.

---

## 8. SG Lie Class

Female V0.1은 Parent Standard와 동일한 Normalized SG Lie Class를 사용한다.

- TEE
- FAIRWAY
- ROUGH
- SAND
- RECOVERY
- GREEN

Raw Lie는 별도로 보존한다.

예:

- FIRST_CUT
- A CUT
- B CUT
- DEEP_ROUGH
- FAIRWAY_BUNKER
- GREENSIDE_BUNKER
- PENALTY_AREA_PLAYABLE
- FRINGE

등은 향후 Mapping Version에서 세분화한다.

---

## 9. Female Scratch Expected Strokes — Off Green

### V0.1 Lookup Table

단위:

**Distance = yards**

| Distance | Tee | Fairway | Rough | Sand | Recovery |
|---:|---:|---:|---:|---:|---:|
| 10 | — | 2.39 | 2.55 | 2.64 | 3.66 |
| 30 | — | 2.61 | 2.79 | 2.75 | 3.66 |
| 50 | — | 2.74 | 2.95 | 3.00 | 3.87 |
| 75 | — | 2.89 | 3.10 | 3.38 | 4.00 |
| 100 | 2.95 | 3.05 | 3.27 | 3.48 | 4.05 |
| 125 | — | 3.19 | 3.42 | 3.53 | 4.11 |
| 150 | 3.15 | 3.37 | 3.62 | 3.67 | 4.23 |
| 175 | — | 3.58 | 3.81 | 3.89 | 4.34 |
| 200 | 3.45 | 3.77 | 4.00 | 4.13 | 4.45 |
| 220 | 3.58 | — | — | — | — |
| 250 | 3.62 | 4.12 | 4.29 | 4.48 | 4.60 |
| 300 | 3.90 | 4.38 | 4.50 | 4.64 | 4.80 |
| 350 | 4.17 | — | — | — | — |
| 400 | 4.46 | 4.71 | 4.90 | 5.29 | 5.35 |
| 420 | 4.60 | — | — | — | — |
| 450 | 4.81 | — | — | — | — |
| 500 | 5.16 | — | — | — | — |
| 550 | 5.48 | — | — | — | — |
| 600 | 5.75 | — | — | — | — |

---

## 10. Off-Green 적용 범위

V0.1에서는:

### Tee

100–600 yards 범위의 Female Tee Curve를 사용한다.

100 yards 미만 Tee State는 현재 구현에서 Fairway Curve로 처리한다.

### Fairway / Rough / Sand / Recovery

현재 검증 범위는:

`<= 400 yards`

이다.

400 yards를 넘는 non-Tee Expected Strokes는 V0.1에서는 임의 extrapolation하지 않는다.

이 경우:

`sg_valid = false`

또는:

`sg_shot = null`

로 처리한다.

---

## 11. Female Scratch Expected Strokes — Putting

단위:

**Distance = feet**

| Distance | Expected Strokes |
|---:|---:|
| 1 ft | 1.01 |
| 2 ft | 1.03 |
| 3 ft | 1.12 |
| 4 ft | 1.25 |
| 5 ft | 1.38 |
| 6 ft | 1.45 |
| 8 ft | 1.56 |
| 10 ft | 1.68 |
| 15 ft | 1.84 |
| 20 ft | 1.95 |
| 30 ft | 2.07 |
| 40 ft | 2.15 |
| 50 ft | 2.23 |
| 60 ft | 2.31 |
| 90 ft | 2.48 |
| 100 ft | 2.53 |

Putting distance가 0이면:

`Expected Strokes After = 0`

으로 처리한다.

---

## 12. Interpolation

Lookup Point 사이의 Expected Strokes는:

**Linear Interpolation**

을 사용한다.

예:

100yd와 125yd 사이의 110yd Fairway Expected Strokes는 두 Anchor 사이에서 선형 보간한다.

V0.1에서 공식 Interpolation Method:

`LINEAR_V1`

이다.

---

## 13. Confidence Policy

Female V0.1은 모든 영역을 같은 신뢰도로 취급하지 않는다.

| 영역 | Confidence |
|---|---|
| Tee | LOW |
| Fairway | MEDIUM |
| Rough | LOW |
| Sand | LOW |
| Recovery | LOW |
| Short Putting | MEDIUM |
| Long Putting | LOW |

이유:

### Fairway

여성 Scratch Approach Proximity 공개 데이터가 Calibration Anchor로 존재하므로 상대적으로 Confidence가 높다.

### Rough / Sand / Recovery

여성 전용 전체 Expected-Strokes 원본표가 공개적으로 확보되지 않았다.

현재는 Female Fairway Curve와 기존 Lie Penalty 구조를 함께 사용한 모델값이다.

### Tee

USGA Women Par Distance와 여성 비거리 데이터를 참고했지만 전체 Shot-level Expected Strokes Table은 아니다.

### Putting

3–6ft 여성 Scratch Make Rate 등 Short Putting Anchor는 존재한다.

Long Putting은 Female-specific Expected-Strokes 전체 Curve가 공개되어 있지 않아 낮은 Confidence로 유지한다.

---

## 14. Female V0.1 Data Quality

Female V0.1 Benchmark 자체는 현재:

`benchmark_quality = LOW`

로 저장한다.

이것은 Player Shot Data의 GPS 품질과 별개다.

따라서 향후에는 다음을 분리할 수 있다.

```text
benchmark_quality
shot_position_quality
pin_quality
lie_quality
sg_quality
```

최종 `sg_quality`는 Benchmark와 Shot Data Quality를 함께 고려한다.

---

## 15. Benchmark Metadata 저장

Female Scratch Benchmark를 사용한 Round에는 최소한 다음 Metadata를 저장한다.

```text
sgBenchmarkMode
sgBenchmarkSex
sgBenchmarkLevel
sgBenchmarkPopulation
sgBenchmarkType
sgBenchmarkSource
sgQuality
sgProfileVersion
sgDataVersion
```

현재 값:

```text
sgBenchmarkMode       = FEMALE_SCRATCH
sgBenchmarkSex        = FEMALE
sgBenchmarkLevel      = SCRATCH
sgBenchmarkPopulation = FEMALE_SCRATCH_AMATEUR
sgBenchmarkType       = MODELED_PUBLIC_CALIBRATED
sgBenchmarkSource     = PUBLIC_CALIBRATED
sgQuality             = LOW
sgProfileVersion      = JGI_FEMALE_SG_V0_1_2026-10-07
```

---

## 16. Male / Female Benchmark 혼합 금지

한 Round의 SG Benchmark는 라운드 시작 시 선택 후 고정한다.

Female Scratch로 시작한 Round에서 중간에 Male Scratch 또는 PGA TOUR Benchmark로 변경하지 않는다.

누적 비교에서도 서로 다른 Benchmark를 그대로 평균 내지 않는다.

예:

- Male Scratch Round
- Female Scratch Round

가 섞인 경우:

동일 Benchmark 기준으로 재계산하지 않았다면 직접적인 Average SG 비교는:

`UNAVAILABLE`

로 처리한다.

---

## 17. Female SG Category

Female Benchmark에서도 Category는 동일하다.

1. **OTT**
2. **APP**
3. **ARG**
4. **PUTT**

따라서:

- Female Par 4/5 Tee Shot = OTT
- Female Par 3 Tee Shot = APP
- Green Edge 27.432m 이내 = ARG
- Start Lie GREEN = PUTT

이다.

Sex에 따라 Category Definition을 바꾸지 않는다.

---

## 18. Male과 Female의 차이는 Benchmark다

동일한 Shot이라도 Expected Strokes가 다르기 때문에 SG 값이 달라질 수 있다.

예:

Female Scratch가 150yd Fairway에서 5ft에 붙였을 경우:

`Female Start Expected = 3.37`

`Female 5ft Putt Expected = 1.38`

따라서:

`SG = 3.37 - 1 - 1.38 = +0.99`

같은 Shot을 Male Benchmark로 계산하면 다른 SG가 나온다.

이는 오류가 아니다.

Benchmark Population이 다르기 때문이다.

---

## 19. Female Handicap Benchmark

V0.1에서는 Female Handicap Benchmark를 임의 생성하지 않는다.

따라서 다음은 아직 `LATER`다.

- FEMALE_HCP_5
- FEMALE_HCP_10
- FEMALE_HCP_15
- FEMALE_HCP_20
- FEMALE_HCP_25

현재 공개자료에서 여성 Handicap Level별 일부 성과 데이터는 확인할 수 있지만:

**Distance × Lie → Full Expected Strokes Table**

을 충분히 검증할 수 있는 형태는 아직 확보되지 않았다.

단순히 Female Scratch에 Handicap 숫자를 더하는 방식은 사용하지 않는다.

---

## 20. LPGA Benchmark

Female Scratch V0.1을:

**LPGA TOUR Benchmark**

라고 표시하지 않는다.

현재 상태:

`LPGA_BENCHMARK = NOT_AVAILABLE`

향후 LPGA/KPMG Shot-level Dataset 또는 동등 수준의 검증 가능한 여성 Tour Data를 확보하면:

`JGI_FEMALE_LPGA_SG_V1`

같은 별도 Benchmark로 관리한다.

Female Scratch V0.1을 LPGA V1로 이름만 변경해서 사용하지 않는다.

---

## 21. Raw Data 우선 원칙

Female Benchmark가 향후 변경될 가능성이 높기 때문에 최종 SG 숫자만 저장하면 안 된다.

반드시:

**Raw Shot State + Benchmark Version + Calculation Version**

을 보존한다.

필요 Raw Data:

- Start Position
- End Position
- Start Lie
- End Lie
- Distance to Hole
- Green Edge Distance
- Pin Position / Source
- Penalty Event
- Holed
- Shot Sequence
- Hole Par
- Benchmark Metadata

이를 통해 Female V1 또는 LPGA Benchmark가 확보되면 과거 Female Round 전체를 재계산할 수 있어야 한다.

---

## 22. Missing Data Policy

Female V0.1에서도 Parent Standard의 Missing 정책을 따른다.

필수 데이터가 없으면:

```text
sg_valid = false
sg_shot = null
```

로 처리한다.

다음과 같은 경우 임의로 0.00 SG를 넣지 않는다.

- Female Benchmark 범위 밖
- Start Distance 없음
- End Distance 없음
- Lie 없음
- Pin / Hole Distance 불명
- Putting Distance 불명
- Penalty 처리 불명

---

## 23. Estimated SG Policy

Female V0.1 자체가 Experimental Benchmark이므로 Player-facing UI에서는:

**JGI Female Scratch · V0.1 · Modeled**

임을 명시한다.

공식 LPGA 값처럼 표시하지 않는다.

특히:

- Rough
- Sand
- Recovery
- Long Tee
- Long Putting

은 Lower Confidence로 관리한다.

---

## 24. Field Validation

Female V0.1은 실제 Female Player Round로 검증해야 한다.

우선 검증할 영역:

### A. Tee

- 150–220yd
- 220–300yd
- 300–420yd
- 420yd+

Curve가 단조롭고 실제 Score Expectation과 일치하는지 확인한다.

### B. Approach

- 50–75yd
- 75–100yd
- 100–125yd
- 125–150yd
- 150–175yd
- 175–200yd

Female Scratch Proximity / GIR / SG Distribution과 비교한다.

### C. Lie

- Fairway
- Rough
- Fairway Bunker
- Greenside Bunker
- Recovery

Female-specific Lie Penalty를 추가 검증한다.

### D. Putting

- 0–3ft
- 3–6ft
- 6–10ft
- 10–20ft
- 20–40ft
- 40ft+

Make Rate와 3-Putt Rate를 비교한다.

---

## 25. V1.0 승격 조건

다음 조건이 충족되기 전까지 V0.1로 유지한다.

- Female Field Test Sample 확보
- Female Tee Curve Smoothing 검증
- Female Rough / Sand / Recovery 보정 근거 강화
- Putting Curve 검증
- Benchmark Source Documentation 강화
- 최소 1개의 독립 여성 Dataset과 비교
- Calculation Regression Test 통과
- Male / Female Benchmark Cross-Mix 방지 테스트 완료

---

## 26. 현재 구현 상태

JGI Player Preview에는 다음 Benchmark가 추가되어 있다.

`FEMALE_SCRATCH`

표시명:

**여자 Scratch · V0.1**

현재 구현 기능:

- Female Scratch 선택
- Female Expected Strokes Lookup
- Linear Interpolation
- Female SG Shot 계산
- Female Putting SG 계산
- Female Benchmark Metadata 저장
- Male Benchmark와 분리
- 공식 LPGA Benchmark와 구분

Main / Production 반영 여부는 별도 Release 승인 절차를 따른다.

---

## 27. V0.1에서 하지 않는 것

JGI Female SG V0.1은 다음을 하지 않는다.

- Female Scratch를 LPGA TOUR라고 표시
- Male PGA TOUR 값을 그대로 Female에 적용
- 공개되지 않은 SwingU 내부 Expected-Strokes Table을 추정 복제
- Female HCP 5/10/15/20/25 값을 임의 생성
- Missing Female Benchmark 영역을 0.00 SG로 처리
- Female과 Male Benchmark 라운드를 같은 기준처럼 직접 평균
- 한두 Round 결과로 Female Model 정확도를 확정
- SG 차이를 성별의 인과적 능력 차이로 해석

---

## 28. V0.1 핵심 원칙

- **Female Player는 Female Benchmark로 평가할 수 있어야 한다.**
- **SG 공식은 남녀 동일하다. Benchmark가 다르다.**
- **Female Scratch V0.1은 Public-Calibrated Model이다.**
- **Female Scratch V0.1은 LPGA 공식 데이터가 아니다.**
- **Fairway Confidence는 상대적으로 높고 Rough/Sand/Recovery는 낮다.**
- **Female Handicap Benchmark는 아직 생성하지 않는다.**
- **Male / Female Benchmark를 한 Round 안에서 혼합하지 않는다.**
- **Raw Shot Data를 보존하여 향후 재계산 가능해야 한다.**
- **Benchmark Version을 반드시 저장한다.**
- **Missing SG ≠ 0.00 SG**
- **실제 Female Field Data로 지속적으로 보정한다.**

---

## 29. 공식 정의

> **JGI Female Strokes Gained V0.1은 여성 Scratch Amateur를 기준 Population으로 사용하는 Experimental Expected-Strokes Benchmark다. 계산 공식과 OTT / APP / ARG / PUTT Category는 JGI Strokes Gained Standard V1을 그대로 따르며, Female-specific 공개 경기 데이터와 Women Par Distance Guidance를 이용해 Female Expected Strokes Curve를 Calibration한다. 현재 Benchmark는 MODELED_PUBLIC_CALIBRATED 상태이며 공식 LPGA Benchmark가 아니다. 모든 계산은 Benchmark Version과 Raw Shot State에 연결하여 저장하고, 향후 더 신뢰도 높은 Female Shot-level Dataset이 확보되면 과거 데이터도 재계산할 수 있어야 한다.**

---

## 30. Version Change Policy

### V0.1

현재 최초 Female Scratch Test Benchmark.

### V0.x

다음과 같은 Calibration 수정:

- Anchor 추가
- Curve Smoothing
- Confidence 수정
- Lie Penalty 수정
- Putting Curve 보정

이 발생할 수 있다.

### V1.0

충분한 Female Field Validation과 외부 Dataset 검증 후 승격한다.

Benchmark 값이 변경되면 반드시:

- Changed Sections
- Change Reason
- Backward Compatibility
- Past Round Recalculation 필요 여부
- Benchmark Version

을 기록한다.

---

## 31. 관련 JGI Standards

이 문서는 다음 Standard와 함께 사용한다.

- `JGI_STROKES_GAINED_STANDARD_V1_0.md`
- `JGI_RAW_SHOT_DATA_STANDARD_V1_0.md`
- `JGI_SHOT_EVENT_FLOW_STANDARD_V1_0.md`
- `JGI_COURSE_INTELLIGENCE_STANDARD_V1_0.md`
- `JGI_STATE_SAMPLING_STANDARD_V1_1.md`
- `JGI_SYSTEM_STANDARDS_INDEX_V1_0.md`

충돌 시 Parent SG Calculation 규칙은:

`JGI_STROKES_GAINED_STANDARD_V1_0.md`

를 우선하고, Female Benchmark Population / Female Expected Strokes Table / Female Confidence는 본 문서를 우선한다.

---

이 문서는 JGI Player의 Female Strokes Gained V0.1 공식 Source 문서로 사용한다.

Female-specific Source와 Field Data가 추가될 때마다 Version을 올리고 변경 이력을 기록한다.
