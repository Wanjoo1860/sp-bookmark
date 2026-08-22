# 즐겨찾기 포털 — 아키텍처 문서

## 1. 개요

Microsoft Teams 기반 즐겨찾기 포털 앱. MSAL 인증, SharePoint List 데이터,
Teams 그룹 기반 RBAC를 사용합니다.

## 2. 기술 스택

| 계층 | 기술 |
|------|------|
| 프론트엔드 | Vanilla JS (ES Modules), HTML5, CSS3 |
| 인증 | MSAL.js 2.x (Azure AD SPA) |
| 데이터 | SharePoint Online List (Microsoft Graph API) |
| 권한 | Teams Group 기반 RBAC (Owner/Member/Guest) |
| 배포 | Cloudflare Workers |

## 3. 아키텍처 다이어그램

브라우저 
├─ index.html 
├─ main.js (엔트리포인트) 
├─ config/ (설정값) 
├─ auth/ (MSAL 인증 + 역할 판별) 
├─ api/ (Graph API 클라이언트) 
├─ services/ (비즈니스 로직) 
└─ ui/ (UI 모듈)

Copy  ↕ Microsoft Graph API
Azure AD ←── 인증/토큰 SharePoint List ←── 북마크 CRUD Teams Group ←── 역할 판별 + 멤버 관리


## 4. 인증 흐름

1. 사용자가 "Microsoft로 로그인" 클릭
2. MSAL Popup 로그인 → Azure AD에서 토큰 발급
3. Access Token으로 Graph API `/me` 호출 → 사용자 정보 취득
4. Teams 그룹의 owners/members 조회 → 역할 판별
5. 역할에 따라 UI 렌더링 (Admin 탭 표시/숨김)

## 5. 데이터 흐름
[UI] → addBookmark() → [DataService] → [SharePoint API] → Graph POST [UI] ← renderNav() ← [DataService] ← [SharePoint API] ← Graph GET


## 6. 역할 매핑

| Teams 역할 | 앱 역할  | 권한 |
|----------- |---------|------|
| Owner      | admin   | 전체 CRUD + 멤버관리 + Guest관리 |
| Member     | member  | 공개 읽기 + 개인 CRUD |
| Guest      | guest   | 공개 읽기 + 개인 CRUD |

## 7. 폴더 구조
sp-bookmark/ 
├─ index.html # 메인 HTML 
├─ main.js # 앱 엔트리포인트 
├─ config/ # 환경 설정 
├─ auth/ # MSAL 인증, 역할 판별 
├─ api/ # Graph API 호출 
├─ services/ # 비즈니스 로직 (데이터, 캐시, 권한) 
├─ ui/ # UI 모듈 (사이드바, 모달 등) 
├─ assets/css/ # 스타일시트 
├─ utils/ # 유틸리티 (에러, 로거, 상수) 
├─ legacy/ # 원본 소스 백업 
└─ docs/ # 문서


## 8. API 권한
User.Read — 현재 사용자 정보 
User.Read.All — 조직 내 사용자 검색 
User.Invite.All — Guest 초대 
Sites.ReadWrite.All — SharePoint List CRUD 
GroupMember.ReadWrite.All — 팀 멤버 추가/제거 
Group.ReadWrite.All — 팀 소유자 관리

