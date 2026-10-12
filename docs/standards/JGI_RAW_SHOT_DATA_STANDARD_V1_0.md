# JGI RAW SHOT DATA STANDARD V1

**Project:** JGI Player  
**Document Type:** Master Shot Data Contract  
**Version:** V1.0  
**Defined:** 2026-10-01  
**Status:** Active Design Standard  
**Review Policy:** 실제 필드 데이터와 DB 구현 검증 후 V1.x 개정

---

## 1. 목적

이 문서는 JGI에서 **한 Shot이 무엇인지**를 공식적으로 정의한다.

JGI의 모든 분석은 다음 Master Unit을 기준으로 한다.

**Player + Course Context + Shot Context + Player State + Result**

한 Shot은 단순히 Club과 결과만 저장하는 객체가 아니다.

Shot은 최소한:

- 누가
- 어느 Round / Hole에서
- 어디에서
- 어떤 상황에서
- 어떤 Club / 목적을 가지고
- 어떤 Shot을 했고
- 어디에 끝났으며
- 어떤 Rule Event가 발생했고
- 어떤 Player State였으며
- 데이터 품질이 어느 수준인지

를 재구성할 수 있어야 한다.

---

## 2. Raw와 Derived를 분리한다

### Raw
실제로 측정, 입력, 자동 감지 또는 외부 Provider에서 받은 원본 정보.

예:
- GPS 좌표
- Club 선택
- Player State 입력
- Penalty 선택
- Course Polygon 판정
- 실제 Hole / Tee Set

### Derived
Raw Data에서 계산되는 값.

예:
- Shot Distance
- Miss Direction
- Landing Zone Width
- SG
- Distance Band
- Round Phase
- Personal Baseline Delta
- Risk Pattern

Derived 값은 Raw를 덮어쓰지 않는다.

---

## 3. Shot Identity

각 Shot에는 최소한 다음 Identity가 필요하다.

- `player_id`
- `round_id`
- `hole_id`
- `hole_number`
- `shot_id`
- `shot_sequence`
- `created_at`
- `updated_at`

`shot_id`는 영구 식별자다.

Shot을 수정해도 새로운 Shot ID를 임의 발급하지 않는다.  
단, 실제로 삭제 후 새 Shot으로 다시 기록한 경우는 새로운 Shot으로 처리한다.

---

## 4. Round / Hole Identity

Shot은 반드시 Round와 Hole에 속해야 한다.

Round 최소 정보:
- `round_id`
- `player_id`
- `course_id`
- `course_version`
- `tee_set_id`
- `round_started_at`
- `round_ended_at`
- `round_status`

Hole 최소 정보:
- `hole_id`
- `round_id`
- `hole_number`
- `hole_par`
- `hole_start_at`
- `hole_end_at`
- `hole_status`

---

## 5. Start State

Shot 직전 Ball State를 저장한다.

필수 후보:
- `start_lat`
- `start_lng`
- `start_altitude`
- `start_position_source`
- `gps_accuracy_start_m`
- `start_lie_raw`
- `start_lie_auto`
- `start_lie_final`
- `start_lie_source`
- `start_distance_to_hole`
- `distance_to_target`
- `distance_to_green_front`
- `distance_to_green_center`
- `distance_to_green_back`
- `distance_to_green_edge`

`start_lie_auto`와 `start_lie_final`은 분리한다.

Player가 자동 판정을 수정하면:
- 자동값 유지
- 수정값 저장
- 수정 여부 기록

---

## 6. Shot Context

최소 후보:
- `club_id`
- `club_type`
- `shot_group`
- `stroke_kind`
- `shot_purpose`
- `intended_target_lat`
- `intended_target_lng`
- `intended_shape`
- `trajectory_height`
- `planned_distance`
- `is_recovery`
- `is_layup`
- `is_green_attack`

`shot_group`, `stroke_kind`, `shot_sequence`, `sg_category`는 같은 필드가 아니다.

---

## 7. Course Context Snapshot

Shot 시점의 Course Context를 Snapshot으로 연결한다.

최소 후보:
- `course_id`
- `course_version`
- `hole_layout_version`
- `tee_polygon_id`
- `fairway_polygon_id`
- `green_polygon_id`
- `bunker_polygon_ids`
- `hazard_polygon_ids`
- `landing_zone_width`
- `left_risk_type`
- `right_risk_type`
- `dogleg_direction`
- `elevation_delta_to_target`
- `wind_context` — Provider 연결 시
- `course_context_quality`

분석 재현성을 위해 “현재 Course Data”만 참조하지 않고 Shot 당시 사용된 Version을 보존한다.

---

## 8. Player State 연결

Player State는 모든 Shot에 존재할 필요가 없다.

연결 필드:
- `state_sample_requested`
- `state_sample_completed`
- `state_sample_skipped`
- `state_sample_source`
- `state_sample_reason`
- `state_sample_id`

실제 State 값은 별도 State Record로 분리 가능하다.

Shot에는 State Record와의 관계만 보존해도 된다.

---

## 9. End / Result State

Shot 이후 다음 Playable State를 저장한다.

최소 후보:
- `end_lat`
- `end_lng`
- `end_altitude`
- `end_position_source`
- `gps_accuracy_end_m`
- `end_lie_raw`
- `end_lie_auto`
- `end_lie_final`
- `end_lie_source`
- `end_distance_to_hole`
- `holed`
- `shot_distance`
- `result_quality`

Shot N의 End State와 Shot N+1 Start State는 가능한 한 연결되어야 한다.

---

## 10. Result Classification

Raw Position과 별도로 분석용 Result Label을 저장할 수 있다.

예:
- `miss_direction`
- `miss_distance`
- `target_hit`
- `fairway_hit`
- `gir_result`
- `green_side`
- `proximity_to_hole`
- `recovery_required`
- `penalty_occurred`

단, 이 값은 Derived 또는 Classification이므로 Calculation/Classification Version과 함께 관리한다.

---

## 11. Penalty / Rules Event

Shot과 연결된 Rule Event는 별도 Event로 저장하는 것을 기본으로 한다.

필드 후보:
- `penalty_event_id`
- `penalty_type`
- `penalty_strokes`
- `relief_type`
- `rule_event_source`
- `next_playable_lat`
- `next_playable_lng`
- `next_playable_lie`

Penalty를 Shot Distance 또는 Shot Sequence 조작으로 숨기지 않는다.

---

## 12. Strokes Gained 연결

SG는 Derived Metric이다.

Shot에는 다음 참조를 둘 수 있다.

- `sg_category`
- `benchmark_id`
- `benchmark_version`
- `calculation_version`
- `expected_strokes_before`
- `expected_strokes_after`
- `transition_strokes`
- `sg_shot`
- `sg_quality`
- `sg_valid`

SG 계산 원본은 별도 `JGI_STROKES_GAINED_STANDARD`를 따른다.

---

## 13. Data Quality / Audit

각 Shot은 최소한 다음 Audit Metadata를 가져야 한다.

- `position_source`
- `lie_source`
- `course_context_source`
- `player_corrected`
- `edit_count`
- `last_edit_source`
- `data_quality_status`
- `raw_capture_version`
- `device_id` — 필요 시
- `client_timestamp`
- `server_timestamp`

---

## 14. Source Type

모든 주요 Raw 값은 Source를 구분한다.

예:
- `GPS_DEVICE`
- `COURSE_PROVIDER`
- `PLAYER_INPUT`
- `SYSTEM_INFERRED`
- `COACH_CORRECTED`
- `ADMIN_CORRECTED`
- `IMPORT`
- `UNKNOWN`

Source가 없으면 값의 신뢰도를 판단할 수 없다.

---

## 15. Unit Standard

DB 내부 기본 단위:
- 거리: meter
- 고도: meter
- 좌표: WGS84 decimal latitude / longitude
- 시간: UTC timestamp
- 각도: degree
- Speed: SI 또는 명시된 unit field와 함께 저장

UI는 Yard / Meter를 Player 설정에 따라 변환한다.

Raw Data에 화면 표시 단위만 저장하지 않는다.

---

## 16. Missing Value 원칙

값이 없으면:
- `null`
- 명시적 `UNKNOWN`
- `NOT_APPLICABLE`

중 하나로 처리한다.

임의의:
- `0`
- 빈 문자열
- 기본 Lie
- 기본 GPS

로 채우지 않는다.

---

## 17. Immutability 원칙

원본 Capture를 보존한다.

Player가 수정하더라도:
- Original Value
- Corrected Value
- Correction Source
- Correction Timestamp

를 추적 가능해야 한다.

중대한 Raw Data 수정은 Audit Log를 남긴다.

---

## 18. 한 Shot의 공식 최소 구조

```text
SHOT
├─ Identity
├─ Round / Hole
├─ Start State
├─ Shot Context
├─ Course Context Snapshot
├─ Player State Link
├─ End / Result State
├─ Rule / Penalty Events
├─ Performance Metrics
└─ Data Quality / Audit
```

---

## 19. V1에서 하지 않는 것

- AI가 Missing Raw Data를 사실처럼 생성
- Derived 값으로 Raw 값을 덮어쓰기
- Shot Sequence와 SG Category를 같은 값으로 사용
- Player Correction 시 원래 자동값 삭제
- Course Data 최신 Version으로 과거 Round를 무조건 재해석
- Missing을 0으로 처리

---

## 20. 공식 정의

> **JGI의 Shot은 실제 경기에서 한 번의 Stroke를 중심으로 Player, Course Context, Shot Context, Player State, Result, Rule Event, Data Quality를 연결하는 영구 Raw Data Unit이다. JGI는 Raw Data와 Derived Metric을 분리하며, 모든 핵심 값의 Source와 Version을 보존하여 향후 새로운 분석 알고리즘이 생겨도 과거 Round를 재계산할 수 있어야 한다.**
