# Cloudflare Access 적용 대기 파일

Zero Trust(Access) 설정이 끝난 뒤에 아래 파일들을 제자리로 옮겨 배포한다.
Access 설정 전에 옮기면 관리자 화면이 무방비로 열리므로 순서를 지킬 것.

| 파일 | 옮길 위치 |
|---|---|
| `leads.js` | `functions/api/leads.js` |
| `admin.html` | `out/admin.html` |

## 선행 조건

1. Zero Trust 팀 이름 생성 (무료 플랜, 50명)
2. Access controls > Applications > Create new application > Self-hosted and private
3. Add public hostname 으로 3개 경로 지정
   - `gonginssa.kr / admin.html`
   - `gonginssa.kr / admin-subscribers.html`
   - `gonginssa.kr / api/leads`
   - `api/consult`, `api/subscribe`, `oauth` 는 절대 포함하지 말 것
4. Access policy: Allow + Emails 에 담당자 주소
5. Pages 환경변수(프로덕션) 추가
   - `CF_ACCESS_TEAM_DOMAIN` — 팀 이름
   - `CF_ACCESS_AUD` — 애플리케이션 상세의 AUD Tag

## 적용하면 달라지는 것

- `admin.html` 의 접근코드 입력창과 `GATE_HASH` 가 사라진다
- `/api/leads` 는 Access JWT 서명을 서버에서 검증한다
- 클라이언트에 비밀번호도 해시도 남지 않는다
