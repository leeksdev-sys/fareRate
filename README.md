# Freight Rate App

의왕ICD 기준 컨테이너 운임 조회 및 업체 관리용 웹앱입니다.  
React + Vite 프론트엔드와 Cloudflare Worker API(Hono), D1 DB를 사용합니다.

## 주요 기능

- 항구/지역 기반 운임 조회
- 업체명 자동완성 및 지역 자동 매핑
- 관리자 페이지에서 업체 추가/수정/삭제
- 관리자 API 보안(Origin 제한, 요청 제한, 토큰 인증)

## 기술 스택

- Frontend: React 19, TypeScript, Vite
- Backend: Cloudflare Workers, Hono
- Database: Cloudflare D1 (SQLite)
- Validation: Zod

## 프로젝트 구조

- API 엔트리: [src/worker.ts](src/worker.ts)
- 사용자 화면: [src/App.tsx](src/App.tsx), [src/LandingPage.tsx](src/LandingPage.tsx)
- 관리자 화면: [src/Admin.tsx](src/Admin.tsx)
- DB 스키마: [schema.sql](schema.sql)
- 분기별 업데이트 절차: [안전운임_분기별_업데이트_절차.md](%EC%95%88%EC%A0%84%EC%9A%B4%EC%9E%84_%EB%B6%84%EA%B8%B0%EB%B3%84_%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8_%EC%A0%88%EC%B0%A8.md)

## 로컬 개발

```bash
npm install
npm run dev
```

품질/빌드 확인:

```bash
npm run lint
npm run build
```

통합 점검(자동화):

```bash
npm run check
```

## 환경 변수 및 보안 설정

`[wrangler.toml](wrangler.toml) 의 `[vars]` 설정:

- `ALLOWED_ORIGINS`: API 허용 Origin 목록(쉼표 구분)

예시:

```toml
[vars]
ALLOWED_ORIGINS = "https://softsheet.org,https://www.softsheet.org,http://localhost:5173,http://127.0.0.1:5173"
```

운영 환경 권장:

- 비밀값은 파일 고정값 대신 `wrangler secret put` 사용
- `ADMIN_TOKEN_SECRET` 는 `ADMIN_PASSWORD` 와 다른 값 사용
- 운영 도메인만 `ALLOWED_ORIGINS` 에 등록

예시 명령:

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_TOKEN_SECRET
```

## 관리자 인증/보안 동작

- `POST /api/admin/login`
  - 입력 비밀번호 검증 후 Bearer 토큰 발급
- `POST/PUT/DELETE /api/admin/*`
  - `Authorization: Bearer <token>` 필요
- 서버 보안 정책
  - 허용 Origin 외 관리자 요청 차단(403)
  - 요청 제한 초과 시 429 + `Retry-After`
  - 인증 실패 누적 시 일정 시간 잠금

## API 요약

- 공개 API
  - `GET /api/ports`
  - `GET /api/search/region?q=...&port=...`
  - `GET /api/rates?port=...&sido=...&sigungu=...&eupmyeondong=...`
  - `GET /api/companies`
  - `GET /api/companies/search?q=...`
- 관리자 API
  - `POST /api/admin/login`
  - `POST /api/admin/companies`
  - `PUT /api/admin/companies/:id`
  - `DELETE /api/admin/companies/:id`

## 배포

자동화 스크립트:

```bash
npm run deploy:dry   # lint + build + wrangler dry-run
npm run deploy       # lint + build + wrangler deploy
```

수동 배포:

```bash
npm run build
wrangler deploy
```

### 배포 체크리스트 (자동화 기준)

- `npm run deploy:dry` 가 성공해야 실제 배포 진행
- `ALLOWED_ORIGINS` 가 운영 도메인만 포함하는지 확인
- `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET` 시크릿이 설정되어 있는지 확인
- 배포 직후 관리자 로그인/업체 CRUD/API 조회 동작 확인

## 데이터 스키마

- 운임 테이블: `freight_rates`
- 업체 테이블: `companies`

자세한 정의는 [schema.sql](schema.sql) 참고.

## 트러블슈팅

- 401(인증 만료): 관리자 페이지에서 재로그인
- 403(출처 차단): `ALLOWED_ORIGINS` 설정 확인
- 429(요청 제한): 응답 헤더 `Retry-After` 이후 재시도
