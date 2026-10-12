# JGI STATE SAMPLING STANDARD V1

**Project:** JGI Player  
**Document Type:** Data Collection Protocol  
**Version:** V1  
**Revision:** 1.1 — Stroke Kind / Context Coverage 추가  
**Defined:** 2026-10-01  
**Status:** Active Design Standard  
**Review Policy:** 실제 필드 데이터 축적 후 V2 재검증

---

## 1. 목적

JGI Player의 목적은 모든 샷에 Player State를 입력시키는 것이 아니다.

JGI가 필요한 것은 Player의 실제 경기에서 다음 관계를 분석할 수 있는 **충분하고 균형 잡힌 개인 데이터**다.

**Player State + Shot Context + Course Context → Shot Result / Miss Pattern**

따라서 JGI는 모든 샷의 State를 수집하지 않고, 분석 가치가 높은 샷을 체계적으로 Sampling한다.

핵심 원칙은 다음과 같다.

> **JGI가 필요한 순간을 선택하고, Player는 그 순간의 State만 정확하게 입력한다.**

모든 Shot Result와 Course Context는 계속 기록하지만, State 입력은 Sampling 대상 Shot에서만 요청한다.

---

## 2. 왜 모든 샷을 입력하지 않는가

72타 기준으로 모든 샷에서 State를 입력하면 약 72회의 추가 입력이 발생할 수 있다.

이는 실제 라운드에서 지속하기 어렵고, 입력 피로가 누적되어 오히려 다음 문제가 발생할 수 있다.

- 입력 누락
- 임의 입력
- State 정확도 저하
- Player의 라운드 집중 방해

따라서 JGI는 **데이터 양의 최대화보다 지속 가능한 고품질 Sampling**을 우선한다.

V1에서는 약 72샷 중 20샷을 Sampling한다.

**20 ÷ 72 = 약 27.8%**

즉 100% Collection Level에서도 전체 샷의 약 **28%만 State 입력 대상**이 된다.

나머지 약 72%의 샷은 State 입력 없이 정상적인 Shot Tracking만 진행한다.

---

## 3. 왜 20라운드 기준인가

JGI의 Personal Intelligence는 한 라운드만으로 완성되지 않는다.

JGI의 기본 학습 단계는 다음과 같이 정의한다.

| 누적 데이터 | JGI 목표 |
|---|---|
| **1 Round** | 오늘의 문제 확인 |
| **5 Rounds** | 반복 패턴 발견 시작 |
| **10 Rounds** | Personal Baseline 형성 |
| **20+ Rounds** | 상황 × State × Miss Risk 분석 |

따라서 State Sampling 역시 **1 Round 기준이 아니라 20-Round Rolling Data Collection**으로 관리한다.

한 라운드에서 일부 Sample을 확보하지 못해도 다음 라운드에서 보완할 수 있다.

---

## 4. JGI 100% Sampling 기준

JGI V1의 100% Data Collection 목표는:

**20 State Samples / Round 평균**

**20 Rounds × 20 Samples = 400 Samples**

로 정의한다.

샷 그룹별 목표는 다음과 같다.

| Shot Group | 1 Round 평균 | 20 Round 목표 |
|---|---:|---:|
| **티샷** | 5 | **100** |
| **세컨샷** | 6 | **120** |
| **숏게임** | 3 | **60** |
| **퍼팅** | 6 | **120** |
| **TOTAL** | **20** | **400** |

`400 Samples`는 통계학적으로 모든 Player와 모든 분석에 적용되는 절대적인 숫자가 아니다.

이는 JGI V1에서 **Player 부담과 개인 Miss Pattern 분석에 필요한 반복 데이터 사이의 실용적인 운영 기준**이다.

실제 필드 데이터가 충분히 쌓이면 V2에서 재검증한다.

---

## 5. Shot Group 정의

### 티샷

Hole을 시작하는 첫 번째 Shot을 의미한다.

JGI는 모든 Tee Shot을 State Sampling하지 않고, 지정된 홀의 Tee Shot만 Sampling한다.

후반 집중력 및 Player State 변화 분석을 위해 반드시 16–18홀 영역도 Sampling 대상에 포함한다.

### 세컨샷

각 Hole의 실제 **두 번째 Shot Sequence**를 의미한다.

Strokes Gained의 `Approach` Category와 동일한 의미가 아니다.

JGI State Sampling에서는 실제 플레이 순서 기준으로 정의한다.

따라서:

**First Shot → Second Shot → Third+ Shot**

이라는 실제 Shot Sequence가 기준이다.

### 숏게임

Green 주변에서 발생하는 Short Game 기회를 의미한다.

예:

- Chip
- Pitch
- Bunker
- Recovery around Green

숏게임은 모든 홀에서 발생하지 않으므로 Tee/Second/Putt와 달리 정확한 Hole을 사전에 강제하지 않는다.

### 퍼팅

Green에서 발생하는 Putt Shot을 의미한다.

JGI가 지정한 Hole에서 Sampling한다.

향후 필요하면 First Putt / Short Putt 등으로 세분화할 수 있지만 V1에서는 Putt Group으로 우선 관리한다.

---

## 6. Shot Group, Stroke Kind, Shot Sequence를 분리한다

JGI는 `shot_group`만으로 샷을 분류하지 않는다.

Miss Pattern을 분석하려면 최소한 다음 세 가지를 분리해서 저장해야 한다.

- `shot_group` — JGI Sampling의 상위 그룹
- `stroke_kind` — 실제 샷의 유형
- `shot_sequence` — 해당 홀에서 몇 번째 샷인지

예:

| Shot Group | Stroke Kind 예시 | Shot Sequence |
|---|---|---:|
| **Tee** | Driver Tee / Wood Tee / Iron Tee | 1 |
| **Second** | Fairway / Rough / Bunker / Recovery | 2 |
| **Short Game** | Chip / Pitch / Greenside Bunker / Recovery | 3+ |
| **Putting** | First Putt / Second Putt / Third+ Putt | Green 내 순서 |

`shot_group`은 Sampling 수량과 Coverage의 기본 단위다.

`stroke_kind`는 같은 Shot Group 안에서 서로 다른 실제 상황을 구분하기 위한 분석 변수다.

`shot_sequence`는 Strokes Gained Category와 관계없이 실제 플레이 순서를 보존한다.

따라서 JGI는 단순히:

**“세컨샷에서 Miss가 많다.”**

수준에 머무르지 않고 향후:

**“150–180m 세컨샷 + Rough + Green Attack에서 특정 State가 반복될 때 우측 Miss가 증가한다.”**

같은 개인별 패턴을 분석할 수 있어야 한다.

### V1 Raw Data 최소 Context

각 Sampling Shot에는 최소한 다음 Context가 연결되어야 한다.

- `shot_group`
- `stroke_kind`
- `shot_sequence`
- `club`
- `start_lie`
- `end_lie`
- `distance_to_target`
- `shot_purpose`

Course/GPS에서 자동으로 얻을 수 있는 정보는 Player에게 다시 입력시키지 않고 시스템이 자동 계산한다.

---

## 8. 왜 이 비율인가

### 티샷 — 100 Samples / 20R

티샷은 매 홀 발생하지만 모든 티샷을 받을 필요는 없다.

대신 라운드 시작부터 16–18홀까지 충분히 분산하여 Player State 변화를 확인할 수 있어야 한다.

평균 **5회/Round**를 사용한다.

### 세컨샷 — 120 Samples / 20R

세컨샷은 Distance, Lie, Hazard, Target, Green 접근 구조 등 Context 변화가 크다.

Player Decision과 Shot Result 관계를 분석하기 위해 Tee Shot보다 조금 더 많은 Sample을 확보한다.

평균 **6회/Round**를 사용한다.

### 숏게임 — 60 Samples / 20R

숏게임은 발생 빈도가 일정하지 않다.

따라서 억지로 Hole별 Sample을 강제하지 않고 실제 Opportunity에서 Sampling한다.

평균 목표는 **3회/Round**다.

### 퍼팅 — 120 Samples / 20R

Putting은 전체 Shot에서 차지하는 비중이 크며, 거리·압박·스코어 상황·후반 State 변화 등을 분석하기 위한 충분한 반복 Sample이 필요하다.

평균 **6회/Round**를 사용한다.

---

## 8. 라운드 구간 정의

JGI는 18홀을 단순 Front 9 / Back 9만으로 구분하지 않는다.

다음 6개의 Sampling Zone으로 구분한다.

| Zone | Hole Range |
|---|---|
| **Front Early** | 1–3 |
| **Front Middle** | 4–6 |
| **Front Late** | 7–9 |
| **Back Early** | 10–12 |
| **Back Middle** | 13–15 |
| **Back Late** | **16–18** |

이 구조를 사용하는 이유는 라운드 진행에 따른 변화를 비교하기 위해서다.

특히 **16–18홀은 독립 Sampling Zone으로 유지**한다.

후반에는 피로, 집중 변화, 경기 흐름 등의 변화가 관찰될 가능성이 있기 때문이다.

JGI는 이를 원인으로 단정하지 않고 실제 State와 Result 관계가 반복적으로 나타나는지를 분석한다.

---

## 9. Front / Back 기본 원칙

20라운드 누적 Sampling은 기본적으로:

**Front 9 = 50%**

**Back 9 = 50%**

를 목표로 한다.

100% Collection 기준:

| Shot Group | Front 9 / 20R | Back 9 / 20R |
|---|---:|---:|
| Tee | 50 | 50 |
| Second | 60 | 60 |
| Short Game | 30 | 30 |
| Putting | 60 | 60 |

단, 이는 정확한 단일 Round 할당이 아니라 **20 Round 누적 기준**이다.

---

## 10. 6개 Zone의 20라운드 목표

100% Sampling 기준의 기본 Zone 분포는 다음과 같다.

| Zone | Tee | Second | Short Game | Putt |
|---|---:|---:|---:|---:|
| **1–3** | 17 | 20 | 10 | 20 |
| **4–6** | 16 | 20 | 10 | 20 |
| **7–9** | 17 | 20 | 10 | 20 |
| **10–12** | 17 | 20 | 10 | 20 |
| **13–15** | 16 | 20 | 10 | 20 |
| **16–18** | **17** | **20** | **10** | **20** |
| **TOTAL** | **100** | **120** | **60** | **120** |

완벽히 동일한 숫자로 나눌 수 없는 Tee Shot 100개는 16/17개씩 분산한다.

핵심은 특정 Zone을 반복해서 Sampling하지 않고 **전체 라운드 진행 구간을 균형 있게 관찰하는 것**이다.

---

## 11. 매 라운드 Sampling 방식

### Tee / Second / Putt

Tee Shot, Second Shot, Putting은 **JGI가 해당 Round의 Sampling Hole을 사전에 결정**한다.

Player가 Hole을 직접 선택하지 않는다.

예:

**Round A Tee**  
`2 / 6 / 9 / 13 / 17`

**Round B Tee**  
`1 / 5 / 8 / 12 / 18`

**Round C Tee**  
`3 / 4 / 7 / 14 / 16`

이는 예시이며 실제 Schedule은 20-Round Sampling Matrix가 결정한다.

---

## 12. 왜 매 라운드 Hole을 변경하는가

항상 동일한 Hole에서 State를 받으면 Course Design 특성이 State 데이터에 과도하게 포함될 수 있다.

예를 들어 항상 같은 Hole에서만 Sample을 받으면 다음과 같은 특정 Context의 영향을 반복적으로 받게 된다.

- Dogleg
- Hazard
- Distance
- 특정 Club
- Hole Difficulty

따라서 JGI는:

**Round 1 ≠ Round 2 ≠ Round 3**

가 되도록 Sampling Hole을 Rotate한다.

20라운드 동안 가능한 한 다양한 Hole과 Course Context가 Sample에 포함되도록 한다.

---

## 13. 홀별 Sampling을 Player에게 맡기지 않는 이유

Player가:

“오늘은 이 샷에서 State를 기록하고 싶다.”

라는 방식으로 기본 Sample을 직접 결정하면 Selection Bias가 발생할 수 있다.

기억에 남는 샷, 긴장된 샷, 미스 샷 등만 과도하게 선택될 가능성이 있기 때문이다.

따라서:

**System-selected Sample = Primary Dataset**

**Player-added State = Supplementary Dataset**

으로 구분한다.

---

## 14. 숏게임 Sampling 방식

숏게임은 특정 홀을 사전에 고정하지 않는다.

예를 들어 8번 홀을 Short Game Sampling Hole로 지정했지만 Player가 GIR을 하면 Short Game Shot 자체가 없다.

따라서 Short Game은 **Opportunity-based Sampling**을 사용한다.

예:

`16–18 Zone Short Game Sample 부족`

→ 17번 홀에서 실제 Chip 발생

→ JGI State 요청

이 방식으로 부족한 Zone의 Sample을 실제 기회 발생 시 확보한다.

---

## 15. Result-Based Sampling 금지

정상 State Sampling 대상 여부는 **Shot Result를 보고 결정하지 않는다.**

예를 들어 Miss Shot 후에만 State를 요청하면 Miss Situation 데이터가 과도하게 많아지고 정상 Shot의 Baseline과 비교하기 어려워진다.

따라서 System Sampling은 원칙적으로:

**Shot Result가 확정되기 전에 Sample Target으로 선정되어 있어야 한다.**

그 Shot이 Good Shot인지 Miss인지 여부와 관계없이 Sample로 유지한다.

OB, Hazard, 3-Putt, Double Bogey 등의 **Special Event / Reset 기록은 별도의 Event Data**로 관리하며 정상 State Sampling 구조와 혼합하지 않는다.

---

## 16. State 입력 시점

State는 Player에게:

**“방금 샷 직전 상태는?”**

이라는 형태로 수집한다.

State는 Shot Result가 아니다.

수집 대상 예:

- 결정 확신
- 생각의 양
- 긴장도
- 루틴 실행
- 필요 시 Thought Focus
- Optional Note

JGI는 Player가 결과를 잘 쳤는지 못 쳤는지를 State 값으로 대체하지 않는다.

---

## 17. Skip 정책

State Sampling은 **절대로 Round 진행을 막지 않는다.**

Player에게는 항상:

**입력하기**

또는

**지금은 건너뛰기**

가 제공된다.

Skip이 발생하면 Sample 목표를 삭제하지 않는다.

JGI는 유사한 Shot Group / Zone / Context의 다음 Opportunity로 Sampling Request를 **Reallocate**한다.

따라서 Skip은:

`Target Removed`

가 아니라

`Target Deferred`

개념으로 처리한다.

---

## 18. Manual State

Player는 JGI가 지정하지 않은 Shot에서도 State를 직접 입력할 수 있다.

이 데이터 역시 저장하고 분석에 사용할 수 있다.

그러나 Sampling Coverage 충족 여부를 판단할 때는 다음을 구분해야 한다.

**AUTO / SYSTEM SAMPLE**

**MANUAL / PLAYER SAMPLE**

Manual Sample은 Coverage를 보완할 수 있지만, System Sampling Plan을 완전히 대체하지 않는다.

---

## 19. 50% / 70% / 100% Collection Level

50%, 70%, 100%는 **분석 정확도**를 의미하지 않는다.

이는 JGI가 Player에게 요청하는 **Data Collection Intensity**다.

Sampling Architecture는 동일하게 유지하고 수량만 비례 조정한다.

| Collection Level | Tee | Second | Short Game | Putt | 20R Total | Round 평균 |
|---|---:|---:|---:|---:|---:|---:|
| **100%** | 100 | 120 | 60 | 120 | **400** | **20** |
| **70%** | 70 | 84 | 42 | 84 | **280** | **14** |
| **50%** | 50 | 60 | 30 | 60 | **200** | **10** |

즉:

**100% Sampling Structure**

를 기준으로

**70% = Sample Density 70%**

**50% = Sample Density 50%**

로 운영한다.

Shot Group 비율, Front/Back 원칙, Zone Coverage 원칙은 유지한다.

---

## 20. Round별 Sample 수는 고정 숫자가 아니다

100% Mode의 평균은 20개지만 반드시 매 Round 정확히 20개일 필요는 없다.

예:

- Round 4 = 18 Samples
- Round 5 = 21 Samples
- Round 6 = 20 Samples

처럼 운영될 수 있다.

왜냐하면 Short Game Opportunity, Skip, Course Structure 등이 매 라운드 다르기 때문이다.

중요한 것은:

**20-Round Rolling Target**

이다.

---

## 21. JGI DATA COVERAGE

Player에게는 누적 데이터 상태를 다음과 같이 보여준다.

**JGI DATA COVERAGE 42% / 100%**

**티샷 62% · 세컨샷 48% · 숏게임 31% · 퍼팅 45%**

이 Coverage는 단순히:

`Collected Samples ÷ 400`

만으로 계산해서는 안 된다.

Coverage는 최소한 다음 Balance를 고려해야 한다.

- Shot Group Balance
- Stroke Kind Diversity
- Shot Sequence Diversity
- Front / Back Balance
- 6-Zone Balance
- Distance Distribution
- Lie / Situation Coverage
- Club / Shot Purpose Distribution
- Player State Distribution

따라서 Sampling 목표 수량을 채웠더라도 특정 `stroke_kind`, Lie, 거리, Club 또는 Shot Purpose에 데이터가 과도하게 몰려 있다면 실제 Coverage는 100%로 판단하지 않는다.

예를 들어 Second Shot 120개를 확보했더라도 대부분이 Fairway Lie에서만 발생했다면 JGI는 Second Shot Context Coverage가 충분하지 않은 것으로 판단한다.

예를 들어 Putt State만 200개 확보했다고 해서 JGI Data Coverage를 50%라고 판단해서는 안 된다.

---

## 22. Adaptive Sampling

JGI는 누적 Coverage를 확인하고 부족한 영역을 다음 라운드 Sampling Schedule에 반영한다.

예:

**Tee 62%**

**Second 48%**

**Short Game 31%**

**Putting 45%**

라면 향후 Sampling에서는 Short Game과 Second Shot 기회를 상대적으로 우선한다.

또한 Shot Group만 보는 것이 아니라:

`Back Late 부족`

`Second Shot 부족`

등을 조합하여 Sampling한다.

예:

**16–18홀 Second Shot Coverage 부족**

→ 다음 라운드의 16~18홀 중 적절한 Second Shot을 Sampling Target으로 지정.

즉 JGI Sampling은 단순 Random Sampling이 아니라 **Coverage-aware Adaptive Sampling**을 목표로 한다.

---

## 23. 20라운드 종료 후

20라운드는 데이터 수집의 종료점이 아니다.

20라운드 이후에도 Sampling은 계속된다.

다만 JGI는 이후부터:

- 부족한 Context
- 새롭게 발생한 상황
- 낮은 Confidence Pattern
- 특정 Miss Risk 조건

을 더 적극적으로 Sampling할 수 있다.

따라서 장기적으로는:

**General Coverage Collection**

에서

**Targeted Personal Intelligence Collection**

으로 발전한다.

---

## 24. 데이터 저장 기준

각 State Sample에는 최소한 다음 Sampling Metadata가 연결되어야 한다.

- `sampling_version`
- `collection_level`
- `sampling_source`
- `sampling_reason`
- `shot_group`
- `stroke_kind`
- `shot_sequence`
- `club`
- `start_lie`
- `end_lie`
- `distance_to_target`
- `shot_purpose`
- `round_phase`
- `hole_number`
- `auto_or_manual`
- `requested`
- `completed`
- `skipped`
- `reallocated`
- `state_timestamp`
- `shot_id`
- `round_id`

V1 기준:

**sampling_version = JGI_STATE_V1**

로 저장한다.

향후 V2에서 Sampling Logic이 변경되어도 어떤 기준으로 수집된 데이터인지 추적할 수 있어야 한다.

---

## 25. JGI Sampling 핵심 정의

> **JGI는 모든 샷의 Player State를 요구하지 않는다. JGI는 20라운드를 하나의 데이터 수집 구간으로 보고, 100% Collection 기준 약 400개의 State Sample을 체계적으로 수집한다. 이는 72타 기준 한 라운드 전체 샷의 약 28%에 해당한다. Sampling은 티샷·세컨샷·숏게임·퍼팅으로 구성하며, 전반/후반과 6개 Round Phase에 균형 있게 분산한다. 티샷·세컨샷·퍼팅의 대상 홀은 JGI가 매 라운드 다르게 지정하고, 숏게임은 실제 기회 발생 시 수집한다. Sampling 여부는 Shot Result를 기준으로 결정하지 않으며, Skip된 Sample은 다음 유사 기회로 재배정한다. 50%와 70% Mode는 동일한 Sampling Architecture를 사용하며 Sample 수량만 줄인다.**

---

## 26. V1 핵심 수치

- **20 Rounds**
- **400 State Samples = 100% Collection Target**
- **20 Samples / Round 평균**
- **약 28% of 72-shot Round**
- **Tee 100**
- **Second Shot 120**
- **Short Game 60**
- **Putting 120**
- **Front 50% / Back 50%**
- **6 Round Phases**
- **System Sampling + Manual Supplement**
- **Shot Group + Stroke Kind + Shot Sequence**
- **Context Diversity is part of Coverage**
- **Skip ≠ Lost Sample**
- **Result-independent Sampling**
- **Adaptive Coverage Reallocation**

---

이 문서는 JGI State Sampling의 공식 V1 기준 원본으로 사용한다.

중요한 것은 `400개`라는 숫자만 보존하는 것이 아니라, **왜 400개인지, 왜 20라운드인지, 왜 전후반을 나누는지, 왜 매 라운드 홀을 바꾸는지까지 함께 보존**하는 것이다.
