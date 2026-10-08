# JGI FEMALE STROKES GAINED STANDARD V0.2

**Project:** JGI Player  
**Document Type:** Female Performance Metric / Handicap Benchmark Extension Standard  
**Version:** V0.2  
**Defined:** 2026-10-08  
**Status:** Experimental / Field-Test Benchmark  
**Supersedes:** Female Handicap policy in `JGI_FEMALE_STROKES_GAINED_STANDARD_V0_1.md` Section 19  
**Base Curve:** `JGI_FEMALE_SG_V0_1_2026-10-07`  
**Implementation Profile:** `JGI_FEMALE_SG_V0_2_2026-10-08`

---

## 1. 목적

JGI Female SG V0.2는 V0.1의 **Female Scratch Amateur Expected-Strokes Curve**를 기준점으로 유지하면서, 여성 Player의 Handicap 0.0–28.0을 하나의 일관된 연속 모델로 계산하기 위한 표준이다.

V0.1의 Female Scratch Curve는 변경하지 않는다.

V0.2에서 추가되는 것은:

**Female Scratch Base → Continuous Female Handicap Lens**

이다.

---

## 2. 핵심 원칙

1. Female Scratch Amateur를 **HCP 0.0 기준점**으로 사용한다.
2. Female Handicap은 **0.0–28.0** 범위에서 연속 계산한다.
3. HCP 5 / 10 / 15처럼 별도 고정 테이블만 만들지 않는다.
4. HCP 4.3, 12.7, 27.8 같은 값도 동일 공식으로 계산한다.
5. Female Scratch V0.1의 거리 × Lie Expected-Strokes Curve는 원본 Base로 보존한다.
6. Male PGA/Tour Expected-Strokes Table을 Female 계산에 사용하지 않는다.
7. Female HCP Lens는 현재 **MODELED**이며 HCP별 실측 Expected-Strokes Table이 아니다.
8. Raw Shot Data와 Benchmark Version을 보존해 향후 재계산 가능하게 한다.
9. HCP 28 초과 값은 V0.2 계산 범위 밖이며 계산 시 28.0으로 clamp한다.
10. Female Scratch HCP 0.0은 Base Curve와 정확히 동일해야 한다.

---

## 3. Benchmark 구조

V0.2의 Benchmark 구조:

```text
Female Scratch Amateur Expected Strokes V0.1
        +
Female Handicap Lens V0.2
        ↓
Female HCP 0.0–28.0 Expected Strokes
        ↓
Shot SG / OTT / APP / ARG / PUTT
```

표시 예:

```text
Player: Female · HCP 5.0
SG Benchmark: Female HCP 5.0 · V0.2 · Modeled
Base: Female Scratch Amateur · V0.1
```

---

## 4. Base Benchmark

V0.2의 Base는 V0.1에서 정의한:

`J_female_scratch(distance, lie)`

이다.

Base Population:

`FEMALE_SCRATCH_AMATEUR`

Base Type:

`MODELED_PUBLIC_CALIBRATED`

Base Version:

`JGI_FEMALE_SG_V0_1_2026-10-07`

Female Scratch V0.1은 LPGA 공식 Benchmark가 아니다.

---

## 5. Handicap 범위

```text
MIN_HCP = 0.0
MAX_HCP = 28.0
```

계산에 사용하는 Handicap:

`H = clamp(player_handicap, 0.0, 28.0)`

HCP 0.0은 Female Scratch와 동일하다.

---

## 6. Handicap Allocation Model

V0.2는 현재 JGI Male Modeled Handicap Lens와 같은 Allocation 구조를 사용한다.

```text
Long Game = 65%
Short Game = 20%
Putting = 15%
```

Reference opportunities per round:

```text
Long = 14
Short = 7
Putting = 30
```

따라서 Handicap H의 State Adjustment는:

```text
Long Offset / State
= H × 0.65 / 14

Short Offset / State
= H × 0.20 / 7

Putting Offset / State
= H × 0.15 / 30
```

---

## 7. Bucket Definition

### Long

다음 중 하나:

- Start Lie = TEE
- Off-Green Distance > 100 yards

### Short

- Off-Green Distance ≤ 100 yards
- GREEN이 아닌 State

### Putting

- Start Lie = GREEN

Female Scratch Base Curve가 해당 Distance / Lie에서 Missing이면 Handicap Lens로 임의 값을 생성하지 않는다.

`Missing Base ≠ 0.00 SG`

---

## 8. Female Handicap Expected Strokes

Female HCP H의 Expected Strokes:

```text
J_female_hcp(distance, lie, H)
=
J_female_scratch(distance, lie)
+
Offset(H, bucket)
```

GREEN:

```text
J_female_hcp_putt(distance, H)
=
J_female_scratch_putt(distance)
+
H × 0.15 / 30
```

Off-Green Long:

```text
J_female_hcp_long(distance, lie, H)
=
J_female_scratch(distance, lie)
+
H × 0.65 / 14
```

Off-Green Short:

```text
J_female_hcp_short(distance, lie, H)
=
J_female_scratch(distance, lie)
+
H × 0.20 / 7
```

---

## 9. HCP 5 예시

H = 5.0일 때:

```text
Long Allocation = 5 × 0.65 = 3.25
Short Allocation = 5 × 0.20 = 1.00
Putting Allocation = 5 × 0.15 = 0.75
```

State Offset:

```text
Long = 3.25 / 14 = 0.232142857...
Short = 1.00 / 7 = 0.142857143...
Putting = 0.75 / 30 = 0.025
```

예를 들어 Female Scratch 150yd Fairway Expected Strokes가 3.37이라면, HCP 5 Long Lens에서는:

```text
3.37 + 0.232142857 = 3.602142857
```

이 값은 **HCP 5 여성 실측 Expected-Strokes 관측값이 아니라 Modeled Lens 결과**다.

---

## 10. SG 공식

SG 공식 자체는 변경하지 않는다.

일반 Shot:

`SG = Expected Before - 1 - Expected After`

Hole Out:

`SG = Expected Before - 1`

Penalty:

Parent Standard인 `JGI_STROKES_GAINED_STANDARD_V1_0.md`의 Penalty 규칙을 따른다.

OTT / APP / ARG / PUTT Category 정의도 Parent Standard와 V0.1을 그대로 따른다.

---

## 11. Legacy V0.1 Round 재계산

과거 Female Round가 다음과 같이 저장되어 있어도:

```text
sgBenchmarkMode = FEMALE_SCRATCH
playerSex = FEMALE
playerHandicap = valid number
```

V0.2 Engine에서는 Raw Shot Data를 이용해:

```text
effective_mode = FEMALE_PLAYER
effective_handicap = clamp(playerHandicap, 0, 28)
```

으로 재계산할 수 있다.

원래 저장된 Raw Shot Position / Lie / Result는 변경하지 않는다.

---

## 12. Metadata

V0.2 Female Handicap Round에는 최소한 다음을 저장한다.

```text
sgBenchmarkMode
sgBenchmarkEffectiveMode
sgBenchmarkSex
sgBenchmarkLevel
sgBenchmarkHandicap
sgBenchmarkHandicapMin
sgBenchmarkHandicapMax
sgBenchmarkPopulation
sgBenchmarkBasePopulation
sgBenchmarkType
sgBenchmarkSource
sgQuality
sgProfileVersion
sgBaseProfileVersion
sgDataVersion
```

권장 값:

```text
sgBenchmarkMode          = FEMALE_PLAYER
sgBenchmarkEffectiveMode = FEMALE_PLAYER
sgBenchmarkSex           = FEMALE
sgBenchmarkLevel         = HCP_<value>
sgBenchmarkHandicap      = 0.0–28.0
sgBenchmarkPopulation    = FEMALE_HANDICAP_MODELED_FROM_SCRATCH
sgBenchmarkBasePopulation= FEMALE_SCRATCH_AMATEUR
sgBenchmarkType          = MODELED_PUBLIC_CALIBRATED_HANDICAP_LENS
sgBenchmarkSource        = PUBLIC_CALIBRATED
sgQuality                = LOW
sgProfileVersion         = JGI_FEMALE_SG_V0_2_2026-10-08
sgBaseProfileVersion     = JGI_FEMALE_SG_V0_1_2026-10-07
```

---

## 13. Player-facing 표시

V0.2에서는 다음처럼 표시한다.

```text
Female HCP 5.0 · V0.2 · Modeled
Base: Female Scratch V0.1
```

다음 표현은 사용하지 않는다.

- LPGA Benchmark
- Official Female HCP 5 Expected Strokes
- Measured Female HCP Population Table

실측 HCP별 Dataset이 아니기 때문이다.

---

## 14. Confidence

Base Female Scratch V0.1의 Confidence 정책을 상속한다.

- Fairway: 상대적으로 높은 Confidence
- Rough: Lower Confidence
- Sand: Lower Confidence
- Recovery: Lower Confidence
- Long Tee: Lower Confidence
- Long Putting: Lower Confidence

Handicap Lens 자체도 MODELED이므로 전체 Benchmark Quality는 현재:

`LOW`

로 유지한다.

---

## 15. Validation

V0.2는 실제 Female Player Round로 검증한다.

우선 검증:

- HCP 0–5
- HCP 5–10
- HCP 10–15
- HCP 15–20
- HCP 20–28

각 구간에서:

- Score vs Expected
- SG Total Distribution
- OTT / APP / ARG / PUTT Distribution
- Distance × Lie SG
- Missing Rate
- GPS / Pin Quality 영향

을 확인한다.

실제 Female HCP별 Shot-level Dataset이 확보되면 현재 Modeled Lens와 비교한다.

---

## 16. Version 정책

### V0.1

Female Scratch Amateur Base Curve.

### V0.2

Female Scratch Base + Continuous HCP 0.0–28.0 Modeled Handicap Lens.

### 향후 V0.x

- Handicap Allocation 보정
- Opportunity Count 보정
- Distance Bucket 보정
- Female Field Data Calibration

### V1.0

충분한 Female Field Validation과 외부 독립 Dataset 검증 후 승격한다.

---

## 17. V0.1과의 충돌 규칙

V0.1 Section 19의:

> Female Handicap Benchmark를 생성하지 않는다.

규칙은 **V0.2에서 supersede**된다.

단, V0.1의 Female Scratch Base Curve, Female-specific source basis, Missing Data Policy, Male/Female 혼합 금지 원칙은 계속 유지한다.

---

## 18. 공식 정의

**JGI Female Strokes Gained V0.2는 Female Scratch Amateur V0.1 Expected-Strokes Curve를 HCP 0.0 기준점으로 사용하고, JGI의 65% Long / 20% Short / 15% Putting Modeled Handicap Allocation을 적용하여 Female HCP 0.0–28.0의 연속 Expected-Strokes Lens를 생성한다. 이 Lens는 HCP별 실측 Population Table이 아니라 MODELED_PUBLIC_CALIBRATED_HANDICAP_LENS이며, 모든 SG는 Raw Shot State와 Benchmark Version을 보존하여 향후 재계산 가능해야 한다.**
