# JGI Standard 원본 등록 안내

이 디렉터리는 제공된 공식 JGI Standard 원본을 보관하고 버전과 참조 관계를 기록하기 위한 구조다. 이 안내 자체는 성능 계산 또는 데이터 정의에 관한 공식 Standard가 아니다.

## 현재 등록된 기존 문서

| 문서 | 원본 위치 | 확인된 상태 | 등록 방식 |
| --- | --- | --- | --- |
| JGI Female Strokes Gained Standard V0.2 | [JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md](../../JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md) | V0.2 / Defined 2026-10-08 / Experimental · Field-Test Benchmark | 기존 파일을 이동·수정·복제하지 않고 링크로 참조한다. |

기존 Female SG V0.2는 현재 위치와 내용을 보존한다. 아래 제공 원본과 기존 문서의 파일명·내용 중복을 확인했으며, 중복 원본은 발견되지 않았다.

## 이번에 제공된 공식 원본 9개

출처는 사용자가 이번 작업에 첨부한 공식 Standard 원본이다. 각 파일은 제공된 파일명과 바이트 내용을 그대로 보관하며, SHA-256과 직접 바이트 비교로 동일성을 확인한다. 문서 내부의 Status와 Version은 원본의 표현을 유지한다. 등록은 문서에 기술된 기능의 구현·검증 완료를 의미하지 않는다.

| 원본 파일 | 원본의 버전 및 상태 |
| --- | --- |
| [JGI_RAW_SHOT_DATA_STANDARD_V1_0.md](JGI_RAW_SHOT_DATA_STANDARD_V1_0.md) | V1.0 / Active Design Standard |
| [JGI_SHOT_EVENT_FLOW_STANDARD_V1_0.md](JGI_SHOT_EVENT_FLOW_STANDARD_V1_0.md) | V1.0 / Active Design Standard |
| [JGI_STATE_SAMPLING_STANDARD_V1_1.md](JGI_STATE_SAMPLING_STANDARD_V1_1.md) | V1 / Revision 1.1 / Active Design Standard |
| [JGI_STROKES_GAINED_STANDARD_V1_0.md](JGI_STROKES_GAINED_STANDARD_V1_0.md) | V1.0 / Active Design Standard |
| [JGI_FEMALE_STROKES_GAINED_STANDARD_V0_1.md](JGI_FEMALE_STROKES_GAINED_STANDARD_V0_1.md) | V0.1 / Experimental · Field-Test Benchmark |
| [JGI_COURSE_INTELLIGENCE_STANDARD_V1_0.md](JGI_COURSE_INTELLIGENCE_STANDARD_V1_0.md) | V1.0 / Official Standard |
| [JGI_FINAL_ROUND_PERFORMANCE_REPORT_STANDARD_V1_0.md](JGI_FINAL_ROUND_PERFORMANCE_REPORT_STANDARD_V1_0.md) | V1.0 / Active Design Standard · Field Validation Required |
| [JGI_TOURNAMENT_COURSE_STRATEGY_STANDARD_V1_0.md](JGI_TOURNAMENT_COURSE_STRATEGY_STANDARD_V1_0.md) | V1.0 / Active Design Standard · Field Validation Required |
| [JGI_SYSTEM_STANDARDS_INDEX_V1_0.md](JGI_SYSTEM_STANDARDS_INDEX_V1_0.md) | V1.0 / Active Design Standard |

기존 Female SG V0.2에서 참조한 Female SG V0.1과 SG V1.0 원본은 이번 등록으로 확보되었다. V0.2 Section 17의 V0.1 충돌 규칙은 기존 원문을 참조한다. 원본 내부에 적힌 Female SG V0.2 파일명은 위 표의 저장소 루트 경로로 찾아야 하며, 이 디렉터리에 V0.2 사본을 만들지 않는다.

## 필요한 누락 원본

아래 14개 파일명은 제공된 [System Standards Index V1.0](JGI_SYSTEM_STANDARDS_INDEX_V1_0.md) Section 2의 명시적 목록에서 확인했다. 저장소와 이번 첨부 자료에 원본이 없어 누락으로 기록한다. 원본을 받기 전까지 파일을 만들거나 내용·버전을 추정하지 않는다.

- `JGI_SHOT_CAPTURE_UI_STANDARD_V1_0.md`
- `JGI_PLAYER_BAG_CLUB_STANDARD_V1_0.md`
- `JGI_PLAYER_STATE_STANDARD_V1_0.md`
- `JGI_COURSE_CONTEXT_STANDARD_V1_0.md`
- `JGI_COURSE_DATA_API_STANDARD_V1_0.md`
- `JGI_DATA_QUALITY_STANDARD_V1_0.md`
- `JGI_OFFLINE_SYNC_STANDARD_V1_0.md`
- `JGI_PERSONAL_BASELINE_STANDARD_V1_0.md`
- `JGI_FEATURE_ENGINEERING_STANDARD_V1_0.md`
- `JGI_REVIEW_AGENT_STANDARD_V1_0.md`
- `JGI_DATA_MODEL_VERSIONING_STANDARD_V1_0.md`
- `JGI_DATA_GOVERNANCE_STANDARD_V1_0.md`
- `JGI_SECURITY_ACCESS_STANDARD_V1_0.md`
- `JGI_FIELD_VALIDATION_STANDARD_V1_0.md`

`COURSE_INTELLIGENCE`와 Index가 나열한 `COURSE_CONTEXT`는 파일명이 다른 문서다. 제공된 원본을 누락 문서의 대체본으로 간주하거나 Index 내용을 수정하지 않는다.

그 밖에 등록할 공식 Standard가 있다면 사용자가 확정한 문서명·버전과 원본이 필요하다. 이 작업에서는 추가 Standard 목록이나 본문을 임의로 정의하지 않는다.

## 원본을 받은 후 등록 절차

1. 제공자·출처, 파일명, 버전, 문서 상태를 확인한다. 확인되지 않은 자료는 공식 원본으로 등록하지 않는다.
2. 저장소 전체의 기존 파일과 비교해 동일 문서·버전인지 확인한다. 동일 원본은 기존 위치를 참조하고 불필요한 사본을 만들지 않는다.
3. 신규 원본은 `docs/standards/`에 제공된 내용을 그대로 보관한다. 번역·요약·편집본을 원본으로 대체하지 않는다.
4. 이 안내의 등록 목록에 실제 경로, 버전, 출처와 확인 상태를 기록한다. 버전 충돌이나 우선순위가 불명확하면 사용자에게 보고한다.
5. 문서 브랜치에서 링크와 원본 일치 여부를 검증하고 PR을 작성한다. 사용자 승인 전 Main 병합은 금지한다.

Standard 등록은 애플리케이션 구현 변경을 자동으로 허가하지 않는다. 코드·DB·Schema·Dependency 변경은 별도 작업 범위와 승인이 필요하다.
