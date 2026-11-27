# AgentAd Trust MVP 테스트 보고서

**2026년 11월 27일 로컬 재검증** · 1차 업무 흐름 11건과 2차 예외·권한 점검 11개 항목을 통과했다. 규칙 엔진은 19/19건, 스마트 계약은 20/20건 통과했고 배포 검증은 7/7개 항목이 일치했다. 이번 브라우저 자동화 실행에서는 환경 준비만 통과했다.

## 실행 환경과 절차

| 항목 | 값 |
|---|---|
| 대상 버전 | agentad-trust 0.1.0 · `0cff260e3f2e0cd777ec8afe5be2062856304ad2` |
| 실행 환경 | Windows · Node.js 24.15.0 · Next.js 16.4.6 · Prisma Client 6.19.3 · SQLite |
| 추천 및 결제 환경 | AI_PROVIDER=rule · 시연 지갑 · Hardhat 로컬 체인 31337 |
| 테스트 도구 | Vitest 5.1.2 · Hardhat 3.22.0 · Playwright 1.65.1 · Microsoft Edge |

1. 의존성을 설치하고 환경 변수를 설정한 뒤 setup을 실행하여 계약을 컴파일하고 데이터베이스 스키마를 적용했다.
2. 로컬 체인(8545)에 계약을 배포하고 역할을 부여한 뒤 웹 앱(3000)을 시작했다.
3. 빈 홈에서 광고 등록, 계약 수락, 추천, 보고, 검증, 승인, 원장 조회 순으로 진행했다. 1차 결과는 기존 화면 캡처와 실행 기록을 기준으로 정리했다.
4. 예외 입력은 API 응답으로, 역할 제한과 상태 전이는 격리된 계약 테스트로 확인했다. 2차의 일부 항목은 3차 자동화 결과를 근거로 하므로 두 회차의 건수를 합산하지 않는다.
5. 단위·계약·브라우저 테스트와 배포 검증을 실행했다. 계약 재컴파일 중 캐시 잠금이 발생해 같은 버전의 기존 컴파일 산출물로 계약 테스트를 다시 실행했다.

팀의 11월 26일 제출 문서에는 브라우저 자동화 14/14 통과가 기록되어 있다. 아래 T16은 11월 27일 별도 환경에서 수행한 재실행 결과다. 이미지 중 T00~T10은 웹 화면이고, T12 이후의 결과 이미지는 실행 로그 또는 API 응답을 발췌한 자료다.

## 1차 · 사용자 업무 흐름

| 번호 | 수행 작업 | 기대 결과 | 실제 결과 | 판정 및 증빙 |
|---|---|---|---|---|
| T00 | 빈 홈 열기 | 계약이 없는 초기 화면 | 로컬 체인 표시와 빈 계약 안내 확인 | 통과 · [T00-home.png](T00-home.png) |
| T01 | 광고 상품 등록 및 계약 제안 | 등록·제안 완료 안내 | 상품 등록과 계약 제안 메시지 확인 | 통과 · [T01-advertiser-proposal.png](T01-advertiser-proposal.png) |
| T02 | 광고 매체에서 계약 수락 | 계약 활성화 | 수락 완료 안내 확인 | 통과 · [T02-publisher-accept.png](T02-publisher-accept.png) |
| T03 | 예산에 맞는 상품 요청 | 후원 표시와 유효 노출 기록 | 후원 카드와 가시 노출 이벤트 확인 | 통과 · [T03-sponsored-card.png](T03-sponsored-card.png) |
| T04 | 상품 가격보다 낮은 예산 입력 | 추천 제외 | 카드 없이 수신 이벤트만 기록 | 통과 · [T04-budget-exceeded.png](T04-budget-exceeded.png) |
| T05 | 미표시 시나리오 실행 | 추천 후 미표시 기록 | 카드가 없고 미표시 이벤트 확인 | 통과 · [T05-not-presented.png](T05-not-presented.png) |
| T06 | 측정 오류 시나리오 실행 | 표시 증거 누락 | 카드는 표시됐고 수신·추천 이벤트만 기록 | 통과 · [T06-measurement-missing.png](T06-measurement-missing.png) |
| T07 | 매체 실적 보고서 제출 | 수신 4건 보고 | 4건 제출 및 제출 상태 확인 | 통과 · [T07-publisher-report.png](T07-publisher-report.png) |
| T08 | 검증기관에서 판정 후 체인에 등록 | 인정 1건·보류 1건 | 판정 수치와 등록 완료 확인 | 통과 · [T08-verification-registered.png](T08-verification-registered.png) · [T08a-verification-details.png](T08a-verification-details.png) |
| T09 | 광고주 승인 후 홈 조회 | 1건 정산 및 절차 완료 | 정산 1건과 6단계 완료 확인 | 통과 · [T09-home-finalized.png](T09-home-finalized.png) · [T09a-advertiser-approved.png](T09a-advertiser-approved.png) |
| T10 | 원장에서 재현 실행 | 기록 5건과 재현 일치 | 이력 5건 및 재현 결과 일치 확인 | 통과 · [T10-ledger-reproduced.png](T10-ledger-reproduced.png) |

## 2차 · 예외 상황과 권한

| 번호 | 수행 작업 | 기대 결과 | 실제 결과 | 판정 및 증빙 |
|---|---|---|---|---|
| T11a | 매체 계정으로 검증 | 검증기관 역할 필요 | AccessControlUnauthorizedAccount | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T11b | 검증기관이 승인하고 매체가 이의 제기 | 두 요청 모두 거부 | 두 호출 모두 AccessControlUnauthorizedAccount | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T11c | 다른 광고주가 해당 계약 승인 | 계약 당사자만 승인 가능 | NotCampaignParticipant | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T11d | 매체 역할이 없는 계정으로 계약 수락 | 수락 거부 | AccessControlUnauthorizedAccount | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T12a | 추가·수정된 증거 검증 | 무결성 불일치 탐지 | 추가 이벤트 제외 및 수정 이벤트 ID 식별 | 통과 · [T14-unit-output.png](T14-unit-output.png) |
| T12b | 같은 보고서 또는 같은 증거 재제출 | 중복 청구 거부 | ReportAlreadyExists 및 EvidenceAlreadyUsed | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T13a | 이의 제기 후 승인 시도 | 사유 보존 및 승인 거부 | Disputed 상태와 사유 해시 확인, 승인 시 InvalidStatus | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T13b | 검증 또는 최종 승인 반복 | 중복 처리 거부 | 두 요청 모두 InvalidStatus | 통과 · [T15-contract-output.png](T15-contract-output.png) |
| T12-1 | 공백만 담은 쇼핑 요청 전송 | 빈 입력 거부 | HTTP 400 | 통과 · [T12-api-output.png](T12-api-output.png) · [T12-api.json](T12-api.json) |
| T12-2 | 301자 쇼핑 요청 전송 | 300자 초과 입력 거부 | HTTP 400 | 통과 · [T12-api-output.png](T12-api-output.png) · [T12-api.json](T12-api.json) |
| T12-3 | 존재하지 않는 계약 ID 조회 | 빈 계약 조회 오류 반환 | HTTP 404 | 통과 · [T12-api-output.png](T12-api-output.png) · [T12-api.json](T12-api.json) |

## 3차 · 자동화 테스트

| 번호 | 수행 작업 | 기대 결과 | 실제 결과 | 판정 및 증빙 |
|---|---|---|---|---|
| T14 | 규칙 엔진 단위 테스트 실행 | 19건 통과 | 19/19 통과 | 통과 · [T14-unit-output.png](T14-unit-output.png) · [T14-detail.log](T14-detail.log) |
| T14-01 | 규칙 엔진 단위 테스트 | 매체 보고 5건 → 검증 실적 2건, 제외 3건 = 미추천 2 + 추천 후 미표시 1 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-02 | 규칙 엔진 단위 테스트 | ‘검증 불가’와 ‘미표시 확인’을 구분한다: 표시·미표시 기록이 모두 없으면 INCONCLUSIVE(정산 보류) | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-03 | 규칙 엔진 단위 테스트 | 화면 증빙 해시가 없으면 검증 불가, 다른 상품 내용이면 INVALID | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-04 | 규칙 엔진 단위 테스트 | 광고 관계 공개(‘광고’ 표기)가 없으면 준수 위반으로 기록하고 정산을 보류한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-05 | 규칙 엔진 단위 테스트 | offerId가 구조적으로 연결되지 않은 추천(상품명만 일치)은 유료 광고 실적이 아니다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-06 | 규칙 엔진 단위 테스트 | 가시성(AD_VIEWABLE)은 보조 지표로 집계되며 정산 건수에는 영향을 주지 않는다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-07 | 규칙 엔진 단위 테스트 | 같은 응답·같은 광고의 표시 이벤트가 재전송되면 1건만 인정하고 DUPLICATE로 제외한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-08 | 규칙 엔진 단위 테스트 | 새 질문으로 받은 새 응답은 별도의 집계 대상이다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-09 | 규칙 엔진 단위 테스트 | 자동 테스트 실행은 실제 광고 집행 실적에서 제외한다 (excludeTestTraffic) | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-10 | 규칙 엔진 단위 테스트 | 시연용 샌드박스 정책은 테스트 트래픽에도 같은 인정 조건을 적용한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-11 | 규칙 엔진 단위 테스트 | 활성 계약 기간 밖의 기록, 등록되지 않은 제안, 연결되지 않은 기록은 제외한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-12 | 규칙 엔진 단위 테스트 | 이벤트 기록으로 뒷받침되지 않는 보고분을 구분한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-13 | 규칙 엔진 단위 테스트 | 제출 이후 표시 이벤트를 몰래 추가하면 해시 불일치로 탐지하고 집계에서 제외한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-14 | 규칙 엔진 단위 테스트 | 제출 이후 이벤트 내용을 바꾸면 수정된 이벤트로 탐지한다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-15 | 규칙 엔진 단위 테스트 | DB의 제출 목록과 해시까지 바꿔도 블록체인에 기록된 해시와 달라 탐지된다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-16 | 규칙 엔진 단위 테스트 | DB의 계약 조건이 블록체인에 확정된 조건과 다르면 무결성 실패 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-17 | 규칙 엔진 단위 테스트 | 이벤트 해시는 내용이 한 글자만 달라도 바뀐다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-18 | 규칙 엔진 단위 테스트 | 입력 순서가 달라도 같은 데이터·같은 정책이면 같은 검증 결과 해시가 나온다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T14-19 | 규칙 엔진 단위 테스트 | 정책이 다르면 같은 데이터라도 결과 해시가 달라진다 | 해당 테스트의 단언 통과 | 통과 · [T14-detail.log](T14-detail.log) |
| T15 | 컴파일된 계약으로 Hardhat 테스트 실행 | 20건 통과 | 20/20 통과 | 통과 · [T15-contract-output.png](T15-contract-output.png) · [T15-detail.log](T15-detail.log) |
| T15-01 | 스마트 계약 테스트 | 광고주가 정책 버전·정책 해시·계약 조건 해시를 제안한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-02 | 스마트 계약 테스트 | 지정된 매체가 같은 조건 해시로 수락하면 계약이 활성화된다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-03 | 스마트 계약 테스트 | 다른 조건 해시로는 수락할 수 없다 (합의 내용 불일치) | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-04 | 스마트 계약 테스트 | 이미 제안된 캠페인은 다시 등록(기준 변경)할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-05 | 스마트 계약 테스트 | 광고주 권한이 없는 지갑은 계약을 제안할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-06 | 스마트 계약 테스트 | 매체와 검증기관이 같은 지갑이면 독립 검증이 아니므로 거부한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-07 | 스마트 계약 테스트 | 매체가 수락하지 않은 계약에는 실적을 제출할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-08 | 스마트 계약 테스트 | 매체 제출, 검증기관 검증(인정·보류 건수), 광고주 확정이 서로 다른 지갑으로 기록된다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-09 | 스마트 계약 테스트 | 광고주는 검증 결과에 이의를 제기할 수 있고, 사유 해시가 기록된다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-10 | 스마트 계약 테스트 | 검증되지 않은 실적은 광고주가 최종 승인할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-11 | 스마트 계약 테스트 | 증빙 해시 불일치(검증 실패)면 반려되고, 반려된 보고는 승인할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-12 | 스마트 계약 테스트 | 검증기관 권한이 없는 지갑의 검증 등록을 거부한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-13 | 스마트 계약 테스트 | 광고주 권한이 없는 지갑의 최종 승인·이의 제기를 거부한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-14 | 스마트 계약 테스트 | 광고주 권한이 있어도 해당 캠페인의 광고주가 아니면 승인할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-15 | 스마트 계약 테스트 | 캠페인에 지정되지 않은 지갑은 계약을 수락하거나 보고를 제출할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-16 | 스마트 계약 테스트 | 같은 보고서 ID를 다시 제출하면 거부한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-17 | 스마트 계약 테스트 | 같은 증빙을 다른 보고서로 이중 청구하면 거부한다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-18 | 스마트 계약 테스트 | 반려되거나 이의 제기된 보고의 증빙은 새 보고서로 다시 제출할 수 있다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-19 | 스마트 계약 테스트 | 이미 검증된 보고서는 다시 검증할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T15-20 | 스마트 계약 테스트 | 이미 확정된 보고서는 다시 승인할 수 없다 | 해당 테스트의 단언 통과 | 통과 · [T15-detail.log](T15-detail.log) |
| T16 | Playwright 직렬 실행 | 환경 준비 및 업무 시나리오 13건 통과 | 준비 1건 통과, 브라우저 시작 단계 1건 실패, 후속 12건 건너뜀 | 재실행 필요 · [T16-launch-error.txt](T16-launch-error.txt) · [T16-e2e-output.png](T16-e2e-output.png) |
| T16-00 | 격리 체인에 계약 배포 | 배포 및 역할 설정 완료 | 환경 준비 테스트 통과 | 통과 · [T16-browser.log](T16-browser.log) |
| T16-01 | 브라우저·API 시나리오 실행 | 광고주: 광고 상품을 등록하고 계약을 블록체인에 제안한다 | Edge가 시작 직후 종료되어 페이지 단언 실행 전 중단 | 환경 제약 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-02 | 브라우저·API 시나리오 실행 | 광고 매체: 같은 조건 해시로 계약을 수락한다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-03 | 브라우저·API 시나리오 실행 | 소비자 · 정상: 광고 카드가 화면에 표시되고, 소비자에게 내부 ID는 보이지 않는다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-04 | 브라우저·API 시나리오 실행 | 소비자 · 예산 초과: 광고를 받았지만 AI가 추천하지 않는다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-05 | 브라우저·API 시나리오 실행 | 소비자 · 화면 미표시: 카드를 그리지 못하고 미표시를 보고한다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-06 | 브라우저·API 시나리오 실행 | 소비자 · 측정 오류: 카드는 보이지만 표시 기록이 남지 않는다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-07 | 브라우저·API 시나리오 실행 | 서버가 발급하지 않은 표시 토큰은 거부된다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-08 | 브라우저·API 시나리오 실행 | 광고 매체: AI가 광고를 받은 횟수(4건)를 실적으로 보고한다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-09 | 브라우저·API 시나리오 실행 | 검증기관: 4건 중 1건 인정·1건 보류로 판정하고 블록체인에 등록한다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-10 | 브라우저·API 시나리오 실행 | 광고주: 검증된 실적을 최종 승인하고, 홈에 노출·정산 결과와 6단계 완료가 표시된다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-11 | 브라우저·API 시나리오 실행 | 블록체인 기록: 5건의 승인 이력, 컨트랙트 권한 거부, 재현 확인 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-12 | 브라우저·API 시나리오 실행 | 증빙 변조: 제출 후 가짜 표시 기록을 넣으면 지문 불일치로 반려된다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T16-13 | 브라우저·API 시나리오 실행 | 재보고 후 광고주 이의 제기: 사유가 블록체인에 기록된다 | 직렬 실행의 선행 단계 실패로 건너뜀 | 미실행 · [T16-launch-error.txt](T16-launch-error.txt) |
| T17 | 배포 코드 및 권한 대조 | 소스·체인·바이트코드·권한 일치 | 7/7 일치, 런타임 코드 5,847바이트 | 통과 · [T17-chain-output.png](T17-chain-output.png) · [T17-chain-verify.log](T17-chain-verify.log) |

## 미완료 항목과 재검증 기준

T16은 Edge가 페이지를 열기 전에 종료되었다. 격리 웹 서버에서도 Prisma 디렉터리 연결 생성 권한 오류가 기록되었다. 일반 Windows PowerShell에서 프로젝트 폴더로 이동하여 `npm.cmd run test:e2e`를 실행하고, 환경 준비 1건과 업무 시나리오 13건의 결과를 각각 확인한다. 재실행 날짜, 대상 커밋, 통과·실패·건너뜀 수와 로그를 추가하면 이번 기록과 비교할 수 있다.
