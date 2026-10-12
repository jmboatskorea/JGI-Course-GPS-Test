# JGI Standard 원본 등록 안내

이 디렉터리는 제공된 공식 JGI Standard 원본을 보관하고 버전과 참조 관계를 기록하기 위한 구조다. 이 안내 자체는 성능 계산 또는 데이터 정의에 관한 공식 Standard가 아니다.

## 현재 등록된 기존 문서

| 문서 | 원본 위치 | 확인된 상태 | 등록 방식 |
| --- | --- | --- | --- |
| JGI Female Strokes Gained Standard V0.2 | [JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md](../../JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md) | V0.2 / Defined 2026-10-08 / Experimental · Field-Test Benchmark | 기존 파일을 이동·수정·복제하지 않고 링크로 참조한다. |

저장소의 기존 Markdown 문서를 확인한 결과, 위 문서와 중복되는 다른 Standard 원본은 발견되지 않았다. 이번 작업에 별도로 첨부된 Standard 원본은 없다. 따라서 외부 원본과 내용이 일치하는지는 확인하지 않았으며, 새 공식 Standard 본문도 생성하지 않는다.

## 필요한 누락 원본

아래 파일명은 기존 Female SG V0.2 문서의 명시적 참조에서 확인했다. 원본을 받기 전까지 파일을 만들거나 내용·버전을 추정하지 않는다.

| 필요한 원본 | 기존 문서의 참조 근거 | 현재 상태 |
| --- | --- | --- |
| `JGI_FEMALE_STROKES_GAINED_STANDARD_V0_1.md` | V0.2의 Supersedes, Base Curve 및 Section 17이 V0.1과 Section 19를 참조한다. | 저장소 및 이번 제공 자료에서 원본 없음. |
| `JGI_STROKES_GAINED_STANDARD_V1_0.md` | V0.2 Section 10이 Parent Standard의 Penalty 규칙을 참조한다. | 저장소 및 이번 제공 자료에서 원본 없음. |

그 밖에 등록할 공식 Standard가 있다면 사용자가 확정한 문서명·버전과 원본이 필요하다. 이 작업에서는 추가 Standard 목록이나 본문을 임의로 정의하지 않는다.

## 원본을 받은 후 등록 절차

1. 제공자·출처, 파일명, 버전, 문서 상태를 확인한다. 확인되지 않은 자료는 공식 원본으로 등록하지 않는다.
2. 저장소 전체의 기존 파일과 비교해 동일 문서·버전인지 확인한다. 동일 원본은 기존 위치를 참조하고 불필요한 사본을 만들지 않는다.
3. 신규 원본은 `docs/standards/`에 제공된 내용을 그대로 보관한다. 번역·요약·편집본을 원본으로 대체하지 않는다.
4. 이 안내의 등록 목록에 실제 경로, 버전, 출처와 확인 상태를 기록한다. 버전 충돌이나 우선순위가 불명확하면 사용자에게 보고한다.
5. 문서 브랜치에서 링크와 원본 일치 여부를 검증하고 PR을 작성한다. 사용자 승인 전 Main 병합은 금지한다.

Standard 등록은 애플리케이션 구현 변경을 자동으로 허가하지 않는다. 코드·DB·Schema·Dependency 변경은 별도 작업 범위와 승인이 필요하다.
