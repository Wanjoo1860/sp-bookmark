# 변경 이력

## v1.0.0 (2026-08-22) — 초기 릴리스

### 변경 사항
- localStorage 인증 → MSAL (Azure AD) 팝업 인증으로 교체
- localStorage 데이터 → SharePoint List CRUD로 교체
- 하드코딩 역할 → Teams 그룹 기반 RBAC로 교체
- 사용자 관리 → 멤버 관리 (검색 + 승격/강등) + Guest 초대/삭제로 교체
- 사용 내역 탭 추가 (Admin 전용)
- 기존 UI/UX 100% 보존 (다크 테마, 사이드바, 호버 카드 등)

### 파일 구조
- 단일 파일(app.js) → ES Module 기반 다중 파일 구조로 리팩터링
- 13개 모듈 파일 + 4개 설정 파일 + 3개 유틸리티 파일

### 기존 대비 제거된 기능
- localStorage 기반 로그인 (ID/PW) → MSAL 대체
- localStorage 기반 사용자 관리 → Teams 그룹 관리 대체
- 클라이언트 차단 도메인 캐시 (dynamicBlocked localStorage 저장) → 메모리 캐시로 변경
