/**
 * [js/main.js]
 * 앱 진입점 — MSAL 초기화 → 인증 → 데이터 로드 → UI 초기화
 * ─────────────────────────────────────────
 * [대체 대상] 기존 app.js의 (function init(){...})() 부분
 */
import { initializeMsal } from '../auth/msal-instance.js';
import { isAuthenticated, loginRedirect, getActiveAccount } from '../auth/auth-guard.js';
import { resolveUserRole } from '../auth/role-resolver.js';
import { loadBookmarks } from '../services/data-service.js';
import { initApp } from '../ui/app-controller.js';

const loginWrap = document.getElementById('loginWrap');
const loginError = document.getElementById('loginError');
const btnMsLogin = document.getElementById('btnMsLogin');

(async function main() {
  try {
    // 1. MSAL 초기화 (리다이렉트 응답 처리 포함)
    await initializeMsal();

    // 2. 인증 상태 확인
    if (!isAuthenticated()) {
      showLogin();
      return;
    }

    // 3. 사용자 역할 결정
    const account = getActiveAccount();
    const { role, userType, profile } = await resolveUserRole(account);

    // 4. 미인가 Guest 차단
    if (role === 'unauthorized') {
      loginError.textContent = '접근 권한이 없습니다. 관리자에게 문의하세요.';
      showLogin();
      return;
    }

    // 5. currentUser 구성
    const currentUser = {
      id: account.username,
      email: profile?.mail || profile?.userPrincipalName || account.username,
      name: profile?.displayName || account.name || account.username,
      objectId: account.localAccountId,
      role: role,
      userType: userType
    };

    // 6. 북마크 데이터 로드
    const bookmarks = await loadBookmarks();

    // 7. 앱 초기화
    initApp(currentUser, bookmarks);

  } catch (error) {
    console.error('앱 초기화 실패:', error);
    loginError.textContent = '초기화에 실패했습니다. 페이지를 새로고침하세요.';
    showLogin();
  }
})();

function showLogin() {
  loginWrap.style.display = 'flex';
  btnMsLogin.addEventListener('click', async () => {
    try {
      await loginRedirect();
    } catch (e) {
      loginError.textContent = '로그인 시작 실패';
    }
  });
}
