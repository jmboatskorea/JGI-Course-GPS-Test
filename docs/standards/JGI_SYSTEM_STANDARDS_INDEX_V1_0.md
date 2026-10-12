# JGI SYSTEM STANDARDS INDEX V1

**Project:** JGI Player  
**Document Type:** Master Standards Index  
**Version:** V1.0  
**Defined:** 2026-10-01  
**Status:** Active Design Standard  
**Purpose:** JGI Player의 DB, API, Mobile UI, Python Analytics, Agent 해석 계층이 동일한 기준으로 동작하도록 공식 원본 문서를 관리한다.

---

## 1. 핵심 원칙

JGI Player는 단순 GPS 앱, 샷 트래커, 기록장치가 아니다.

JGI의 목적은:

**Player + Course Context + Shot Context + Player State + Result**

를 Raw Data로 정확히 저장하고,

**현재 문제 진단 → 평소와 비교 → 반복 패턴 탐색 → 위험 예측 → 다음 행동 1개 제시**

로 연결하는 On-Course Performance Analyst / Player Agent를 구축하는 것이다.

모든 공식 Standard는 다음 원칙을 따른다.

- Raw Data를 우선 보존한다.
- Derived Metric은 언제든 재계산 가능해야 한다.
- Player 입력은 최소화한다.
- GPS / Course Data로 자동 판정 가능한 항목은 시스템이 자동 처리한다.
- Missing Data를 정상값으로 위장하지 않는다.
- Result와 원인을 혼동하지 않는다.
- 관찰된 관계와 인과를 구분한다.
- 모든 계산·분류·Sampling 규칙은 Version 관리한다.
- 필드 테스트 결과에 따라 V1.x 또는 V2로 개정한다.

---

## 2. 공식 Standard Set

### A. Shot / Round Core
1. `JGI_RAW_SHOT_DATA_STANDARD_V1_0.md`  
   한 Shot의 Master Raw Data 구조.

2. `JGI_SHOT_EVENT_FLOW_STANDARD_V1_0.md`  
   Shot 생성, 결과, Penalty, Edit/Undo, Hole 종료의 상태 흐름.

3. `JGI_SHOT_CAPTURE_UI_STANDARD_V1_0.md`  
   라운드 중 Player 입력 최소화와 자동 Capture / Correction 기준.

4. `JGI_PLAYER_BAG_CLUB_STANDARD_V1_0.md`  
   Player Bag, Club Identity, 장비 변경 및 Club별 분석 기준.

5. `JGI_STATE_SAMPLING_STANDARD_V1_1.md`  
   어떤 Shot에서 Player State를 받을지 결정하는 Sampling 기준.

6. `JGI_PLAYER_STATE_STANDARD_V1_0.md`  
   State 변수의 의미, Scale, 저장 방식, Missing/Skip 기준.

### B. Course / Position Intelligence
7. `JGI_COURSE_CONTEXT_STANDARD_V1_0.md`  
   Tee, Fairway, Green, Bunker, Hazard, Distance, Landing Zone 등 Course Context 정의.

8. `JGI_COURSE_DATA_API_STANDARD_V1_0.md`  
   Google Maps + Golf Intelligence + Cache + Lazy Load + Version 관리.

9. `JGI_DATA_QUALITY_STANDARD_V1_0.md`  
   GPS, Pin, Lie, Polygon, Timestamp, Auto/Manual Correction 품질 기준.

10. `JGI_OFFLINE_SYNC_STANDARD_V1_0.md`  
   라운드 중 통신 불안정 시 Local-first Capture와 동기화 기준.

### C. Performance / Analytics
11. `JGI_STROKES_GAINED_STANDARD_V1_0.md`  
   Shot Value 계산 및 SG Category 기준.

12. `JGI_PERSONAL_BASELINE_STANDARD_V1_0.md`  
    1R/5R/10R/20R+ Personal Baseline과 Sample/Confidence 기준.

13. `JGI_FEATURE_ENGINEERING_STANDARD_V1_0.md`  
    Python Analytics에서 Raw → Derived Feature로 변환하는 공식 기준.

14. `JGI_REVIEW_AGENT_STANDARD_V1_0.md`  
    Hole Review, Live Round Review, Final Review, 행동 제안 기준.

### D. System Integrity / Governance
15. `JGI_DATA_MODEL_VERSIONING_STANDARD_V1_0.md`  
    Identity, Raw/Derived 분리, Audit, Calculation Version, Schema 변경 원칙.

16. `JGI_DATA_GOVERNANCE_STANDARD_V1_0.md`  
    Player Data, Consent, Sensitive State, 향후 Health Data의 사용 범위와 보존 원칙.

17. `JGI_SECURITY_ACCESS_STANDARD_V1_0.md`  
    Player/Coach/Admin 권한, Secret, Environment, API Key 보안 기준.

18. `JGI_FIELD_VALIDATION_STANDARD_V1_0.md`  
    실제 라운드 테스트, 데이터 품질 확인, Release Gate 기준.

---

## 3. 구현 우선순위

### Phase 1 — Data Capture Foundation
- RAW SHOT DATA
- SHOT EVENT FLOW
- SHOT CAPTURE UI
- PLAYER BAG / CLUB
- COURSE CONTEXT
- PLAYER STATE
- STATE SAMPLING
- DATA QUALITY

### Phase 2 — Reliable Round Operation
- COURSE DATA API
- OFFLINE SYNC
- DATA MODEL VERSIONING
- SECURITY & ACCESS
- FIELD VALIDATION

### Phase 3 — Performance Intelligence
- STROKES GAINED
- PERSONAL BASELINE
- FEATURE ENGINEERING
- REVIEW AGENT

### Phase 4 — Expanded Data
- DATA GOVERNANCE
- Health / Wearable integration extensions
- Advanced predictive models

---

## 4. Source of Truth 원칙

문서 간 충돌이 발생하면 다음 우선순위를 따른다.

1. 더 최신 Version의 동일 Standard
2. 해당 Domain의 전용 Standard
3. Master Index
4. 과거 기획 메모 / 대화

예:

- State 요청 시점 → `STATE SAMPLING STANDARD`
- State 값 자체 의미 → `PLAYER STATE STANDARD`
- SG Category → `STROKES GAINED STANDARD`
- 한 Shot에 저장되는 실제 필드 → `RAW SHOT DATA STANDARD`
- GPS 신뢰 가능 여부 → `DATA QUALITY STANDARD`

---

## 5. 변경 관리

공식 Standard 수정 시 반드시 다음을 기록한다.

- Version
- Revision Date
- Changed Sections
- Change Reason
- Backward Compatibility
- DB Migration 필요 여부
- 과거 데이터 Recalculation 필요 여부

V1.x:
- 기존 철학과 Schema를 유지하는 호환 가능한 보완

V2:
- 데이터 의미, 핵심 계산, Sampling Architecture 또는 Schema Contract가 바뀌는 중대한 변경

---

## 6. 현재 미확정 항목

다음은 임의 확정하지 않는다.

- JGI SG 최초 Benchmark Population / Dataset
- Putting 위치 Capture 방식
- GPS HIGH/MEDIUM/LOW/INVALID 숫자 Threshold
- Personal Baseline 최소 Sample 숫자의 세부 구간별 Threshold
- Confidence Score의 실제 통계 모델
- Offline Retry Time / 서버 Conflict TTL
- Health/Wearable 데이터의 실제 Provider별 Schema

이 항목들은 Field Validation 또는 외부 Data Source 계약이 확인된 후 V1.x에서 확정한다.

---

## 7. 시스템 구축 원칙

DB는 Raw Data의 Source of Truth다.  
Python은 Statistics / Feature Engineering / Prediction을 담당한다.  
JGI Agent는 해석 / 질문응답 / 행동 제안을 담당한다.

**AI가 Raw Data를 대신 만들거나 수정해서는 안 된다.**

JGI의 첫 번째 자산은 모델이 아니라:

**일관되고 재현 가능한 Shot-Level Raw Data**

이다.
