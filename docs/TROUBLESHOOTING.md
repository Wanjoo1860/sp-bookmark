# 트러블슈팅 가이드

## 1. AADSTS50011 — Redirect URI 불일치

**증상:** 로그인 시 "The redirect URI specified in the request does not match" 오류

**원인:** Azure AD 앱 등록의 Redirect URI와 실제 배포 URL이 다름

**해결:**
1. Azure Portal → 앱 등록 → 인증 → SPA 섹션
2. `https://sp-bookmark.wjlee1860.workers.dev` 정확히 등록 확인
3. 끝에 `/` 유무 주의 (등록된 것과 정확히 일치해야 함)

---

## 2. 403 Forbidden (Graph API)

**증상:** API 호출 시 403 오류

**원인:** API 권한 미부여 또는 관리자 동의 누락

**해결:**
1. Azure Portal → 앱 등록 → API 사용 권한
2. 6개 Scope 모두 등록 확인
3. "(조직명)에 대한 관리자 동의 허용" 클릭

---

## 3. 500 generalException (SharePoint)

**증상:** 북마크 CRUD 시 500 오류

**원인:** SharePoint List 컬럼 이름 불일치 또는 타입 오류

**해결:**
1. Graph Explorer에서 columns 확인
2. `sharepoint.config.js`의 컬럼명과 실제 `name` 값 일치 확인
3. SortOrder가 number 타입인지 확인

---

## 4. Guest 초대 실패

**증상:** "Authorization_RequestDenied" 또는 초대 API 오류

**원인:** External Identities 설정 미허용

**해결:**
1. Azure Portal → Azure Active Directory → External Identities
2. 외부 협업 설정 → "게스트 초대 허용" 확인
3. User.Invite.All 권한 + 관리자 동의 확인

---

## 5. Admin 판별 실패

**증상:** Owner인데 member로 표시됨

**원인:** GroupMember.ReadWrite.All 또는 Group.ReadWrite.All 미부여

**해결:**
1. API 사용 권한에서 두 권한 모두 등록 확인
2. 관리자 동의 재실행
3. 팀 그룹 ID가 정확한지 확인

---

## 6. 사용자 검색이 안됨

**증상:** 직원 검색 시 결과 없음

**원인:** User.Read.All 권한 미부여 또는 ConsistencyLevel 헤더 누락

**해결:**
1. User.Read.All 권한 확인
2. graph-client.js에서 `ConsistencyLevel: eventual` 헤더 포함 확인
3. 검색어 2자 이상 입력 확인

---

## 7. 토큰 만료 — 자동 갱신 실패

**증상:** 일정 시간 후 API 호출 실패

**원인:** Silent token 갱신 실패 (3rd party cookie 차단 등)

**해결:**
1. MSAL의 acquireTokenPopup 폴백이 동작하는지 확인
2. 브라우저 3rd party cookie 허용 또는 캐시 설정 확인
3. auth.config.js의 cacheLocation이 'localStorage'인지 확인

---

## 8. Site ID 오류

**증상:** SharePoint API 호출 시 "Resource not found"

**원인:** Site ID가 부분만 복사됨

**해결:**
1. 쉼표(,) 포함 3개 부분 모두 복사 확인
2. 예: `myworkweb.sharepoint.com,41f0478e-...,c7c8a765-...`
3. sharepoint.config.js의 siteId 값 재확인
