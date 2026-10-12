# JGI SHOT EVENT FLOW STANDARD V1

**Project:** JGI Player  
**Document Type:** Round / Shot Lifecycle Standard  
**Version:** V1.0  
**Defined:** 2026-10-01  
**Status:** Active Design Standard

---

## 1. 목적

Shot Data가 정확해도 Event Flow가 불명확하면:
- Shot Sequence가 꼬이고
- Penalty가 이중 반영되고
- Undo 후 SG가 틀어지고
- Hole 종료와 Round 종료가 불일치할 수 있다.

이 문서는 라운드 중 Shot이 어떻게 생성되고 확정되는지를 정의한다.

---

## 2. Round Status

기본 상태:
- `CREATED`
- `IN_PROGRESS`
- `PAUSED`
- `COMPLETED`
- `ABANDONED`

Round는 첫 Hole 시작 전까지 `CREATED`, 실제 플레이가 시작되면 `IN_PROGRESS`다.

---

## 3. Hole Status

기본 상태:
- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`
- `SKIPPED`

Hole이 완료되기 전 다음 Hole로 이동할 수 있으나, 시스템은 미완료 상태를 명시적으로 유지한다.

---

## 4. Shot Lifecycle

기본 흐름:

```text
SHOT INTENT / START POSITION
→ SHOT RECORD CREATED
→ BALL PLAYED
→ END POSITION / RESULT CAPTURED
→ RULE EVENT CHECK
→ STATE SAMPLE CHECK
→ SHOT CONFIRMED
→ NEXT SHOT or HOLE OUT
```

---

## 5. Shot Record 생성 시점

Shot Record는 Player가 Shot 전 Club/Target을 입력했을 때 생성할 수도 있고,
Shot 후 Ball 위치를 확정할 때 생성할 수도 있다.

V1의 핵심은 UI 방식이 아니라 다음 불변조건이다.

**한 실제 Stroke = 한 Shot Record**

Penalty Stroke는 실제 Physical Shot처럼 별도의 가짜 Shot Record를 만들지 않는다.

---

## 6. Shot Sequence

`shot_sequence`는 해당 Hole에서 실제 Physical Stroke 순서를 의미한다.

예:
- 첫 Tee Shot = 1
- OB가 나서 다시 Tee에서 치는 Physical Shot = 2
- 다음 Shot = 3

Penalty 자체는 Shot Sequence를 증가시키지 않는다.
공식 Score Stroke Count에는 Penalty가 포함된다.

---

## 7. Hole Score 계산

기본:
`Hole Score = Physical Shot Count + Penalty Strokes`

JGI는 Shot Record 수와 Score를 같은 것으로 가정하지 않는다.

---

## 8. OB / Lost Ball

기본 Flow:

```text
Physical Shot
→ OB / Lost Ball Event
→ Penalty Strokes 기록
→ Next Playable State 결정
→ 다음 Physical Shot
```

OB를 이유로 첫 Shot Record를 삭제하지 않는다.

---

## 9. Penalty Area / Drop

```text
Shot
→ Penalty Area Event
→ Penalty + Relief Type
→ Drop / Next Playable Position
→ Next Shot
```

Drop Position은 Result/Rule Event의 일부이며 Physical Shot이 아니다.

---

## 10. Unplayable

Unplayable 선언은:
- 원인 Shot
- Penalty
- Relief
- Next Playable State

로 연결한다.

---

## 11. Hole Out

Ball이 Hole Out되면:
- 해당 Shot `holed = true`
- End Expected Strokes = 0
- Hole Status = `COMPLETED`
- Score Validation 실행

Hole Out 없이 Player가 Hole 종료를 선택하면:
- Conceded / Pickup / Max Score 등 별도 종료 사유가 필요하다.
- 이 상태는 Exact Shot-by-Shot SG와 구분할 수 있어야 한다.

---

## 12. Putt Sequence

Putting Green 안에서는 별도로:
- `putt_sequence = 1,2,3...`

를 둘 수 있다.

Hole 전체의 `shot_sequence`와 혼동하지 않는다.

---

## 13. State Sampling 시점

State는 Shot Result가 확정된 뒤 묻더라도 질문 의미는:

**“방금 Shot 직전 상태는?”**

이다.

Sampling Target 선정은 Shot Result 이전에 이루어져야 한다.

---

## 14. Edit

허용 가능한 수정:
- Club
- Lie
- Position
- Penalty Type
- Penalty Stroke
- Result Classification
- State 입력 오류

수정 후:
- 관련 Derived Metric 재계산
- SG 재계산
- Hole / Round Summary 재계산

을 트리거한다.

---

## 15. Undo

Undo는 마지막 UI Action을 취소하는 기능이지 Raw History 삭제 기능이 아니다.

Undo 후:
- 현재 Effective State는 되돌리되
- Audit Log에는 이전 Action을 남긴다.

---

## 16. Delete

실제로 잘못 생성된 Shot은 삭제 가능하나:
- Soft Delete 권장
- `deleted_at`
- `deleted_by`
- `delete_reason`

을 보존한다.

삭제 후 Shot Sequence는 UI에서 재정렬할 수 있지만 원본 Event History는 추적 가능해야 한다.

---

## 17. Duplicate Shot 방지

동일 Shot이:
- Local 저장
- 서버 Retry
- 화면 재접속

때문에 두 번 생성되지 않도록 Client-generated Unique ID 또는 Idempotency Key를 사용한다.

---

## 18. Hole 이동

Player가 잘못된 Hole로 이동했을 경우:
- 자동 Hole Detection이 Shot을 강제로 이동시키지 않는다.
- Player가 확정할 수 있어야 한다.
- Original Auto Hole과 Final Hole을 보존한다.

---

## 19. Round 종료 Validation

Round 완료 전 확인:
- Hole Status
- Physical Shot Count
- Penalty 합계
- Score 합계
- 미완료 Shot
- 미확정 Rule Event
- Sync Pending
- Invalid Position

오류가 있어도 Round 저장 자체를 막지 않을 수 있지만 상태를 명확히 표시한다.

---

## 20. 공식 정의

> **JGI Shot Event Flow는 한 실제 Stroke를 하나의 Shot Record로 보존하고, Penalty와 Relief를 별도 Rule Event로 연결하며, Shot Sequence, Hole Score, SG 계산이 서로 일관되게 유지되도록 하는 공식 Lifecycle이다. 모든 Edit/Undo/Delete는 Derived Metric 재계산과 Audit 추적이 가능해야 한다.**
