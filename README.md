# COURTBOARD — wireless controller edition

기존 메인 점수판·확장 뷰어를 유지하면서 다른 기기의 컨트롤러를 연결합니다.

## 사용

1. 메인 점수판의 메뉴에서 **컨트롤러 연결 → 연결 코드 만들기**.
2. 다른 기기에서 같은 사이트의 `/controller.html`을 열어 6자리 코드를 입력.
3. 메인 점수판에서 기기 이름을 확인하고 **연결 승인**.
4. 컨트롤러 버튼 또는 기존 키보드 배열로 조작. H는 누르는 동안 메인 기기에서 버저가 울립니다.

현재 Sites 배포는 비공개입니다. 두 기기에서 같은 ChatGPT 계정으로 로그인해야 합니다. 연결 코드는 12시간 유효하며 컨트롤러는 한 대만 승인합니다. 승인 대기는 1분입니다. 컨트롤러를 바꾸려면 메인에서 연결 해제하세요.

메인 기기가 유일한 경기 상태 관리자입니다. 경기 선택·팀명 변경·저장·종료는 메인 기기에서 합니다. 경기 기록은 메인 브라우저의 localStorage에 저장됩니다. 컨트롤러는 점수·파울·시계 입력을 먼저 화면에 반영하고 메인의 처리 확인으로 조정합니다. 확인 전에는 ‘메인 확인 중’을 표시합니다. 쿼터 전환과 직전 조작 취소도 확인창 이후 로컬에 먼저 반영하고, 메인 결과와 일치시킵니다. 연결 후 WebRTC 데이터 채널로 기기 간 직접 전달을 우선 시도합니다. 직접 연결 시 화면에 왕복 지연(ms)을 표시합니다. STUN은 stun.cloudflare.com을 사용하며, 직접 연결이 막힌 네트워크에서는 HTTP 서버 중계로 전환됩니다. 모든 환경에서 무지연 전달을 보장하지는 않습니다. 메인 반영에는 실제 통신 시간이 필요합니다. 정밀한 계시가 중요한 공식 경기는 현장에서 지연·연결 안정성을 먼저 확인하세요.

네트워크가 끊기면 컨트롤러 입력을 중지합니다. 오래된 명령을 재접속 시 재생하지 않습니다. 결과 확인이 지연되었다는 메시지가 나오면 현재 점수와 시간을 확인한 후 다음 입력을 하세요. 메인 점수판은 계속 직접 조작할 수 있습니다. 브라우저 절전·화면 잠금은 꺼두세요.

가로 화면은 장비형 3열 배치, 세로 화면은 터치용 2열 배치입니다. **컴팩트**와 **전체화면** 버튼을 제공합니다. 전체화면 API를 지원하지 않는 iPhone 브라우저에서는 가로 모드 또는 홈 화면에 추가해 실행하세요. iOS/iPadOS·Android 실제 기기별 검증은 별도로 필요합니다.

## 로컬 테스트

Node.js 22 이상에서:

```sh
npm test
npm run build
node scripts/preview.mjs
```

`http://localhost:8000`에서 열립니다. 테스트 서버의 중계 저장소는 메모리이며 종료 시 삭제됩니다. `test.cjs`는 경기 로직, `test-relay.mjs`는 승인·인증·중복 명령·연결 해제를 검증합니다. `scripts/browser-test.cjs`는 Playwright와 Chromium이 있는 환경의 두 세션 통합 테스트입니다.

## 카드 없이 서버 배포 (Cloudflare Workers Free + D1)

이 배포 설정은 R2를 사용하지 않습니다. Cloudflare Workers Free와 D1으로 시작하세요. 카드나 유료 플랜 가입은 필요하지 않습니다. 공식 안내: https://www.cloudflare.com/products/d1/

1. Node.js 22 이상과 Cloudflare 무료 계정을 준비합니다.
2. 프로젝트 폴더에서 `npx wrangler login`을 실행하고 브라우저에서 로그인·승인합니다.
3. `npx wrangler d1 create courtboard-remote`를 실행합니다.
4. 출력된 `database_id`를 `wrangler.jsonc`의 `PASTE_YOUR_DATABASE_ID_HERE` 대신 넣습니다. 이 ID는 비밀번호가 아닙니다. 기존 DB가 있다면 그 DB의 ID를 쓰고, 생성 명령을 반복하지 마세요.
5. `wrangler.jsonc`의 `ALLOWED_ORIGIN`에 GitHub Pages origin을 넣습니다. 예: `https://username.github.io` (저장소 경로와 끝 슬래시 제외).
6. `npx wrangler d1 migrations apply courtboard-remote --remote`를 실행하고 적용을 확인합니다. `migrations/0001_rooms.sql`이 테이블을 생성합니다.
7. `npm test`, `npm run build`, `npx wrangler deploy`를 순서대로 실행합니다.
8. 반환된 `https://courtboard.계정.workers.dev` 주소가 서버 주소입니다.

파일 이름이 wrangler.jsonc.txt로 바뀌지 않도록 주의하세요. `database_id`는 본인 Cloudflare에서 생성된 실제 값이어야 합니다. 서버는 DB 바인딩을 사용합니다. 기존 Sites 환경을 위해 R2 어댑터도 코드에 남아 있지만, 내보내기의 Wrangler 설정은 D1만 사용합니다.

무료 플랜 한도: Workers 요청 하루 10만 회, D1 읽기 하루 500만 행·쓰기 하루 10만 행·총 저장 5GB입니다. 계정 내 다른 앱의 사용량도 영향을 줍니다. 무료 한도에 도달하면 무선 연결이 실패할 수 있으므로 대회 전 사용량을 확인하세요. 메인 점수판의 로컬 조작은 별개입니다. 유료 플랜으로 업그레이드하지 않으면 이 무료 구성으로 운영합니다.

연결 코드는 12시간 후 만료되며, 새 연결 생성 시 만료된 DB 행을 정리합니다. DB에는 현재 경기 요약과 일시적 명령만 보관하고 대회 전체 기록은 메인 브라우저에 남습니다.

자체 배포 서버에는 Sites 로그인 보호가 포함되지 않습니다. 코드 입력 후 메인에서 승인해야 조작 권한이 부여됩니다. 모르는 기기는 승인하지 마세요.

## 기존 GitHub Pages와 연결

1. 위 Worker 서버를 먼저 배포합니다.
2. `dist/remote-config.js`의 `COURTBOARD_RELAY_URL`을 Worker의 HTTPS 주소로 설정합니다.
3. Worker의 `ALLOWED_ORIGIN` 변수를 GitHub Pages의 origin(예: `https://username.github.io`, 저장소 경로 제외)으로 설정합니다.
4. GitHub Pages에 갱신한 `dist/`를 게시합니다. 컨트롤러도 같은 GitHub Pages 주소의 `/controller.html`을 사용하세요.

비공개 Sites 주소를 GitHub Pages의 서버 주소로 연결하지 마세요. 교차 사이트 로그인 쿠키 정책에 막힐 수 있습니다. GitHub Pages에는 직접 배포한 Worker를 연결하세요.

## 배포 파일

`dist/`의 HTML/CSS/JS는 정적 소스, `worker/relay.mjs`는 D1/R2 호환 중계 API, `scripts/build.mjs`는 정적 파일을 포함한 Worker를 생성합니다. `dist/server/index.js`는 생성 파일입니다. `dist/sw.js` 캐시 버전을 변경하면 오프라인 자산이 갱신됩니다. 무선 연결은 인터넷이 필요하며 기존 단독 점수판만 오프라인으로 사용할 수 있습니다.

내보내기에는 Sites 프로젝트 ID·토큰·Git 이력·실제 경기 기록이 포함되지 않습니다. 기록은 기존 점수판에서 JSON 백업 후 새 주소에서 복원하세요. 라이선스는 임의로 지정하지 않았습니다.

### 반응 속도 검증

컨트롤러 점수·파울·시계 표시는 네트워크 응답을 기다리지 않고 먼저 반영합니다. 메인 처리 확인 전에는 확인 중 표시를 유지합니다. 지연·실패 시 메인 상태로 복구하며 중복 명령 ID를 재실행하지 않습니다. 브라우저에 900ms 인위 지연을 넣은 화면 반응 테스트와 별도 브라우저 통합 테스트를 수행했습니다. `scripts/direct-path-test.cjs`는 모사된 데이터 채널로 직접 명령 처리·확인·중계 대체 경로를 검증합니다. 관리 브라우저가 WebRTC UDP를 제한하므로 실제 ICE 연결 성립 여부는 사용자 기기에서 검증해야 합니다.
