# JGI Player 프로젝트 맥락

## 제품 목적

JGI Player는 단순 GPS·Shot Tracker가 아닌 개인 **On-Course Performance Analyst**다.

**Player + Course Context + Shot Context + Player State + Result**를 연결해 현재 경기 문제를 진단하고 다음 행동을 제안한다. 위치와 샷을 기록하는 데서 끝나지 않고, 코스 상황·샷 의도·플레이어 상태·실제 결과를 함께 해석한다.

관측된 사실, 계산된 수치, 해석을 구분한다. 누락된 샷·위치·원인을 만들어 내지 않고, GPS 품질·표본 수·Benchmark 성격을 반영해 설명한다. 플레이어 상태와 결과의 연관성을 곧바로 인과관계로 단정하지 않는다.

## 아키텍처 역할 원칙

| 역할 | 책임 |
| --- | --- |
| DB | Raw Data와 출처·버전 정보를 보존해 재분석이 가능하게 한다. |
| Calculation / Python | 보존한 데이터에 기반한 계산, 분석, 예측을 담당한다. |
| JGI Agent | 제공된 사실과 계산 결과를 해석하고 행동을 제안한다. |

위 표는 제품의 역할 분리 원칙이다. 이 문서는 DB나 Python 서비스를 새로 도입하지 않으며, 현재 저장소에 해당 서비스가 구현되어 있다는 의미도 아니다.

## 현재 저장소에서 확인되는 구현

| 구성 | 현재 역할과 위치 |
| --- | --- |
| 브라우저 앱 | [index.html](index.html)이 UI, GPS·Google Maps/JGI 코스 보기, 라운드·샷 기록과 분석을 포함한다. 라운드·이력·상태는 브라우저 `localStorage`에 저장한다. |
| Course Context | [jagorawi-old-course-data.js](jagorawi-old-course-data.js), [jagorawi-old-scorecard-data.js](jagorawi-old-scorecard-data.js), [ora-south-left-course-data.js](ora-south-left-course-data.js)에 코스·스코어카드 데이터가 있다. |
| SG 계산 | [jgi-strokes-gained-data.js](jgi-strokes-gained-data.js)가 Benchmark 데이터를 제공하며, 현재 계산 로직은 브라우저 JavaScript에 있다. 측정 기반과 Modeled Benchmark를 구분한다. |
| JGI Agent | [api/jgi-agent.js](api/jgi-agent.js)가 선택된 라운드 Context를 받아 OpenAI Responses API에 전달한다. 제공된 사실에 근거한 해석과 행동 제안을 요청한다. |
| WHOOP | `api/whoop/`의 서버 핸들러와 [lib/whoop.cjs](lib/whoop.cjs), [whoop-pilot.js](whoop-pilot.js)가 선택적 상태 연동을 담당한다. |
| 배포 구성 | [vercel.json](vercel.json)과 [scripts/build-vercel.cjs](scripts/build-vercel.cjs)가 정적 출력과 브라우저 Maps 설정을 준비한다. 기본 Cloud 개발 검증과 Production 빌드는 구분한다. |

현재 저장소에는 서버 DB/Schema 또는 Python 분석 서비스가 확인되지 않는다. 위 역할 원칙을 이유로 저장 방식·Dependency·계산 엔진을 변경하지 않는다. 도입이 필요하면 별도 Objective와 사전 승인을 받는다.

## 공식 Standard 참조

[Standard 등록 안내](docs/standards/README.md)를 기준으로 원본과 누락 항목을 확인한다. 기존 [Female SG V0.2](JGI_FEMALE_STROKES_GAINED_STANDARD_V0_2.md)는 현재 위치와 내용을 보존한다. 해당 문서의 상태는 **Experimental / Field-Test Benchmark**이며, Modeled Lens를 실측 Female HCP Population Table이나 LPGA 공식 Benchmark로 표현하지 않는다.

공식 문서가 누락되어 있으면 현재 코드나 제품 설명을 원본 대신 등록하지 않는다. 개발 변경은 [AGENTS.md](AGENTS.md)의 범위·검증·승인 절차를 따른다.
