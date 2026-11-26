# AgentAd Trust — MVP (시연 서비스)

AI 에이전트 대상 광고의 **집계 기준을 검증**하고, 그 결과를 **실제 블록체인 네트워크에서 공동 승인**하는 웹 서비스입니다.
(블록체인개론 체인팀 · 고한영 / 김승현 / 설선선)

> AI가 광고를 **받은 것(수신)**, **추천한 것(추천)**, **화면에 보여준 것(표시)** 은 서로 다른 사건입니다.
> 매체는 ‘받은 횟수’를 보고하지만, 계약은 ‘소비자 화면에 표시된 횟수’만 인정합니다.
> 그 차이를 검증기관이 원본 기록으로 다시 세고, 광고주·매체·검증기관이 각자의 지갑으로 블록체인에 확정합니다.
> (계약 정책의 근거·표준 비교는 발표 자료에서 다룹니다.)

## 화면 구성 (역할별 워크스페이스)

| 메뉴 | 누가 | 하는 일 |
| --- | --- | --- |
| **홈 · 시연 진행판** | 발표자 | 6단계 진행 상황, ‘지금 할 일’, 수신→추천→표시 깔때기, 매체 보고 vs 인정 실적 |
| **광고주** | 광고주 지갑 | 광고 상품 등록 + 계약 제안(한 번에), 검증된 실적 최종 승인 또는 이의 제기 |
| **광고 매체** | 매체 지갑 (쇼핑 AI 운영사) | 계약 수락, ‘AI가 광고를 받은 횟수’로 실적 보고 |
| **소비자** | 소비자 | 쇼핑 AI 채팅. 오른쪽 시연 패널에서 시연 조건·광고 기록 확인 |
| **검증기관** | 검증기관 지갑 | 기록을 한 건씩 대조(계약 광고·유료 추천·화면 표시·광고 표기), 증빙 지문 대조, 결과 등록 |
| **블록체인 기록** | 누구나 | 블록 순서대로 본 승인 이력, 컨트랙트 권한 테스트, 검증 결과 재현 확인 |

모든 화면은 상단의 **현재 캠페인**을 기준으로 동작합니다. 시연 지갑 모드에서는 각 화면에 맞는 역할 지갑이 자동으로 서명합니다.

## 빠른 시작 (로컬 블록체인)

Node.js 22 이상(권장 24)이 필요합니다.

```powershell
npm install
```

```powershell
Copy-Item .env.example .env
```

```powershell
npm run setup
```

`setup` = 컨트랙트 컴파일 + ABI 내보내기 + SQLite 스키마 생성(`prisma/agentad.db`).

터미널 1 — 로컬 블록체인 노드 (켜 둔 채로 두세요)

```powershell
npm run chain
```

터미널 2 — 컨트랙트 배포 후 웹 앱

```powershell
npm run chain:deploy
```

```powershell
npm run dev
```

http://localhost:3000 — 상단 오른쪽이 초록색 **로컬 블록체인**이면 준비 완료입니다.

> 로컬 노드를 재시작하면 체인 기록이 사라집니다. `npm run chain:deploy`로 다시 배포하고,
> 깨끗하게 시작하려면 `npm run db:reset`(로컬 DB 전체 삭제)을 직접 실행하세요.

### 서명 방식

- **시연 지갑** (기본, 로컬 체인 전용): Hardhat 공개 테스트 계정 `#1 광고주`, `#2 광고 매체`, `#3 검증기관`이 화면별로 자동 서명합니다.
- **MetaMask**: 상단 토글로 전환. 화면마다 해당 역할 계정을 골라 서명합니다. 역할이 다른 계정이면 컨트랙트가 거부합니다.

### Claude API (선택)

`.env`에 `ANTHROPIC_API_KEY`를 넣으면 쇼핑 AI가 Claude(`claude-opus-5-5`)로 추천합니다. 없으면 규칙 기반 추천기가 응답합니다.
예산 조건(“3만 원 이하”)은 두 방식 모두 서버에서 먼저 반영합니다. AI는 광고 기록을 **발생**시킬 뿐, 판정에는 쓰이지 않습니다.

## 시연 순서 (약 4분)

1. **광고주** — 기본값(모아 데일리 텀블러 · 모아리빙 · 24,000원) 그대로 `등록하고 계약 제안하기`.
2. **광고 매체** — 계약 조건을 확인하고 `같은 조건으로 수락`. 계약이 확정되어야 AI가 광고를 받습니다.
3. **소비자** — 시연 패널의 추천 질문으로 네 가지 경우를 만듭니다.
   - “3만 원 이하로 출근할 때 쓸 텀블러 추천해 줘” (정상) → 수신·추천·**표시**
   - “2만 원 이하 텀블러 추천해 줘” → 광고를 받았지만 예산 때문에 **추천 안 함**
   - 시연 조건 `화면 미표시` + 같은 질문 → 추천됐지만 **화면 미표시 보고**
   - 시연 조건 `측정 오류` + 같은 질문 → 카드는 보이지만 **표시 기록 없음**
   - (선택) `예시 대화 5건 만들기` = 발표 예시 수신 5 · 추천 3 · 표시 2
4. **광고 매체** — `실적 보고`: 매체는 AI가 광고를 받은 횟수(예: 4건)를 보고합니다.
5. **검증기관** — `검증 실행` → **4건 중 1건 인정, 1건 보류**(미추천·미표시는 제외) → `검증 결과 등록`.
6. **광고주** — 인정 실적을 `최종 승인`(또는 `이의 제기`).
7. **홈** — 6단계가 모두 완료되고, 매체 보고 vs 인정 실적이 막대로 보입니다.
8. **블록체인 기록** — 5건의 승인 이력(블록 번호·트랜잭션), `권한 테스트`(컨트랙트가 직접 거부), `다시 계산해 비교`(재현 일치).
9. **증빙 변조** — 새 보고 후 검증기관 화면의 `증빙 변조해 보기` → `다시 검증`: 지문 불일치 → `반려 기록`. 홈의 ‘지금 할 일’이 재보고로 바뀝니다.

## 테스트

```powershell
npm run test:unit
```

정책 엔진 19개: 5·3·2 판정, 검증 불가 vs 미표시 확인, 화면 증빙 누락·불일치, 광고 표기 위반, 구조화되지 않은 추천, 중복, 테스트 트래픽,
증빙·계약 조건 변조 탐지, 재현성.

```powershell
npm run test:contract
```

컨트랙트 20개: 광고주 제안·매체 수락, 수락 전 보고 거부, 무단 제안/수락/검증/승인/이의 제기 거부, 독립성, 인정·보류 건수 기록,
이의 제기, 중복 제출·이중 청구 거부, 반려·이의 제기 후 재제출.

```powershell
npm run test:e2e
```

Playwright 14개: 별도 노드(8546)·별도 DB·별도 서버(3100)로 위 시연 순서 전체를 실제 브라우저(Edge)에서 실행합니다.
광고 카드가 뷰포트에 50% 이상 보이는지 Playwright로 교차 확인하고, 소비자 카드에 내부 ID가 노출되지 않는지도 확인합니다.
E2E는 실행마다 `prisma/e2e/run-*.db`를 새로 만들며 기존 DB를 지우지 않습니다.

### 개발 완료 기준 대응

| 테스트 | 통과 조건 | 확인 위치 |
| --- | --- | --- |
| 사용자 입력 | AI가 실제 상품 추천 결과 반환 | E2E `소비자 · 정상` |
| 광고 집계 | 수신·추천·표시를 별도로 집계 | E2E 소비자 4종, 단위 테스트 |
| 보고 검증 | 계약 기준에 따라 실적 차이 계산 | E2E `검증기관`, 단위 테스트 |
| 무단 승인 | 권한 없는 지갑의 트랜잭션 거부 | 컨트랙트 테스트, E2E `블록체인 기록 · 권한 테스트` |
| 중복 제출 | 동일 보고서 재처리 거부 | 컨트랙트 테스트 |
| 증빙 변조 | 저장된 해시와 원본 증빙의 불일치 탐지 | E2E `증빙 변조`, 단위 테스트 |
| 온체인 기록 | 제안·수락·제출·검증·확정/이의 제기 조회 | 블록체인 기록 화면 / Etherscan (Sepolia 배포 후) |

## Sepolia 배포 (실제 공개 테스트넷)

1. 세 역할용 MetaMask 계정(광고주·매체·검증기관)과 배포용 계정을 준비하고, 배포 계정에 Sepolia ETH를 받습니다.
2. 비밀키는 코드나 `.env`에 커밋하지 말고 Hardhat 키스토어에 저장합니다.

```powershell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

```powershell
npx hardhat keystore set SEPOLIA_RPC_URL
```

3. 역할 지갑 주소를 지정하고 배포합니다 (`deployments/sepolia.json` 생성 — 커밋 대상).

```powershell
$env:ADVERTISER_ADDRESS="0x..."; $env:PUBLISHER_ADDRESS="0x..."; $env:VERIFIER_ADDRESS="0x..."; npm run chain:deploy:sepolia
```

4. Etherscan 소스코드 검증 (배포 스크립트가 정확한 명령을 출력합니다).

```powershell
npx hardhat keystore set ETHERSCAN_API_KEY
```

```powershell
npx hardhat verify --network sepolia <컨트랙트주소> <배포자주소>
```

5. `.env`에서 `CHAIN_NETWORK=sepolia`(필요하면 `CHAIN_RPC_URL`)로 바꾸고 `npm run dev`. 서명은 MetaMask로 하며, 트랜잭션은 Etherscan 링크로 표시됩니다.

## 동작 원리 요약

- **이벤트 5종** (DB에 원본 저장): `AD_RECEIVED`(수신) · `AD_RECOMMENDED`(유료 추천, offerId 구조적 연결) · `AD_PRESENTED`(화면 표시 + 화면 증빙 해시, **정산 기준**) · `AD_VIEWABLE`(50%·1초, 보조) · `AD_NOT_PRESENTED`(미표시 보고)
- **판정**: 광고 단위(`campaignId + offerId + responseId`)마다 인정(VALID) · 제외(INVALID) · 보류(INCONCLUSIVE) · 중복(DUPLICATE).
  표시·미표시 기록이 모두 없으면 ‘미표시’가 아니라 **검증 불가(보류)** 입니다. 규칙은 `policies/*.json`(데이터)에 있고, 시연 서비스는
  `AGENTAD-PRESENTED-V1-SANDBOX`(같은 인정 조건을 시연 데이터에도 적용, 정산 대상 아님)로 계약합니다.
- **블록체인에는 지문(해시)과 승인 상태만**: 계약 조건 해시(제안·수락), 증빙 해시(보고), 인정·보류 건수와 검증 결과 해시(검증), 확정/이의 제기.
  보고 후 DB 원본을 바꾸면 다시 계산한 증빙 지문이 체인과 달라 탐지됩니다.

### 스마트 컨트랙트 `AgentAdRegistry.sol`

| 함수 | 호출자 | 역할 |
| --- | --- | --- |
| `registerCampaign()` | 광고주 | 정책 ID·정책 해시·계약 조건 해시·매체·검증기관·기간 제안 |
| `acceptCampaign()` | 캠페인 매체 | 같은 조건 해시로 수락 → 계약 확정 |
| `submitReport()` | 캠페인 매체 | 보고 실적 + 증빙 해시 (확정된 계약만) |
| `verifyReport()` | 캠페인 검증기관 | 인정·보류 건수 + 검증 결과 해시, 증빙 불일치 시 반려 |
| `approveReport()` / `disputeReport()` | 캠페인 광고주 | 최종 확정 / 이의 제기(사유 해시) |
| `getReport()` / `getCampaign()` | 누구나 | 상태 조회 |

컨트랙트는 원본 광고 기록이 사실인지 스스로 알 수 없습니다. 정책 엔진의 판정을 검증기관 지갑이 책임지고 제출하고, 공동 승인 이력만 남깁니다.

### 백엔드 API

| API | 기능 |
| --- | --- |
| `GET/POST /api/campaigns`, `GET /api/campaigns/:id` | 광고 계약 목록·생성 / 실시간 판정·이벤트·보고서 |
| `POST /api/campaigns/:id/chain` | 계약 제안(`propose`)·수락(`accept`) 트랜잭션 확인 |
| `GET /api/campaigns/:id/ledger` | 온체인 기록 (트랜잭션·블록 번호·시각) |
| `POST /api/chat` | 쇼핑 AI 질문 → 광고 제공·추천·이벤트 저장 |
| `POST /api/events/display` | 소비자 화면 이벤트 (서버 발급 토큰 필요) |
| `POST /api/reports/submit` | 매체 보고: 증빙 목록 고정 + 증빙 해시 |
| `POST /api/reports/verify` | 정책 엔진 판정 (`mode: "reproduce"` 재현 확인) |
| `GET /api/reports/:id`, `POST /api/reports/:id/chain` | 판정·온체인 상태 / 제출·검증·확정·이의 제기 트랜잭션 확인 |
| `GET /api/chain/config` | 네트워크·컨트랙트·역할 지갑 |
| `POST /api/test/scenario`, `POST/DELETE /api/test/tamper` | 시연 도구: 예시 대화 · 증빙 변조/정리 |

브라우저가 보낸 트랜잭션 해시를 그대로 믿지 않고, 서버가 영수증의 컨트랙트 주소·이벤트·ID와 온체인 해시를 대조한 뒤 DB에 반영합니다.

## 폴더 구조

```
app/
  page.tsx (홈 진행판)  advertiser/  publisher/  consumer/  verifier/  ledger/
  api/                                   # 백엔드 API
components/                              # 화면 (app-shell, 역할별 *-view, results, product-card …)
policies/                                # 집계 계약 정책 데이터 (JSON)
lib/
  ai/ ads/ events/ campaigns/ reports/ verification/ policy/ blockchain/ test-mode/
  ledger.ts                              # 블록체인 기록 화면 데이터
  client/progress.ts                     # 홈 진행판 6단계 계산
contracts/AgentAdRegistry.sol
scripts/  prisma/  deployments/
tests/  verification/  contract/  e2e/
```

## 팀원별 개발 경계

| 담당자 | 담당 코드 |
| --- | --- |
| 고한영 | `contracts/`, `tests/contract/`, `scripts/deploy.ts`, `lib/blockchain/`, `lib/ledger.ts`, Sepolia 배포·검증 |
| 김승현 | `app/api/`, `lib/ai`, `lib/ads`, `lib/events`, `lib/verification`, `lib/policy`, `policies/`, `prisma/` |
| 설선선 | `components/` 화면·UX, 화면 표시 측정(`components/shopping/product-card.tsx`), `tests/e2e/` |

## MVP 한계 (발표 Q&A 참고)

- `AD_PRESENTED`는 렌더링 사실이지 사람이 읽었다는 증거가 아닙니다.
- 자체 쇼핑 AI·프론트엔드가 보낸 기록을 쓰므로, 보고 **이전**의 조작은 해시만으로 막지 못합니다. 상용화하려면 독립 측정 SDK가 필요합니다.
- 보류(INCONCLUSIVE) 건의 증빙 보완 절차는 구현하지 않았습니다. 보류 건수는 체인에 기록되고 확정 실적에서 빠집니다.
- 검증 엔진은 같은 서버에서 실행됩니다. 결과 해시를 체인에 남겨 누구나 재계산으로 재현할 수 있게 했습니다.
- 상품 사진 대신 카테고리 아이콘 썸네일을 씁니다. 실제 광고비 결제는 구현하지 않습니다.
