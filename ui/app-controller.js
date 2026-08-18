/**
 * [ui/app-controller.js]
 * 앱 메인 컨트롤러 — 모든 UI 모듈 조립 및 초기화
 * ─────────────────────────────────────────
 * [대체 대상] 기존 app.js IIFE 전체의 초기화/이벤트 바인딩 부분
 */
import { $ } from '../utils/dom-helpers.js';
import { initDynamicBlocked } from '../utils/url-helpers.js';
import { initSidebar, renderNav } from './sidebar-renderer.js';
import { initModalController, openSettingsModal } from './modal-controller.js';
import { initBookmarkModal, renderBmList, setCurrentUser as setBmUser } from './bookmark-modal.js';
import { initUserModal, renderMemberList, setCurrentUser as setUserModalUser } from './user-modal.js';
import { initIframeHandler, showWelcome } from './iframe-handler.js';
import { toast } from './toast.js';
import * as dataService from '../services/data-service.js';
import { logoutRedirect } from '../auth/auth-guard.js';

const sidebar = $('#sidebar');
const btnManager = $('#btnManager');
const btnLogout = $('#btnLogout');
const footerUser = $('#footerUser');
const inputVis = $('#inputVis');

let currentUser = null;

/**
 * 앱 초기화 (로그인 성공 후 호출)
 */
export function initApp(user, bookmarks) {
  currentUser = user;

  // body 클래스
  document.body.classList.toggle('is-admin', user.role === 'admin');

  // UI 표시
  $('#loginWrap').style.display = 'none';
  sidebar.style.display = 'flex';

  // 사용자 이름 표시
  footerUser.textContent = user.name || user.email;

  // 동적 차단 목록 초기화
  initDynamicBlocked();

  // 모듈 초기화
  initSidebar();
  initIframeHandler();

  initModalController({
    onModalOpen: handleModalOpen,
    onEditClose: () => { /* 편집 모달 닫힘 시 처리 */ }
  });

  initBookmarkModal({
    currentUser: { role: user.role, email: user.email },
    onDataChanged: handleDataChanged
  });

  initUserModal({
    currentUser: { role: user.role, email: user.email, objectId: user.objectId },
    onDataChanged: handleDataChanged
  });

  // 관리 버튼
  btnManager.addEventListener('click', () => {
    openSettingsModal(currentUser);
  });

  // 로그아웃
  btnLogout.addEventListener('click', async () => {
    await logoutRedirect();
  });

  // 가시성 선택 (관리자만 표시)
  if (currentUser.role === 'admin') {
    inputVis.style.display = '';
  } else {
    inputVis.style.display = 'none';
  }

  // 사이드바 렌더링
  renderNav(bookmarks, { role: user.role, email: user.email });
  showWelcome();
}

function handleModalOpen(user) {
  // 가시성 select
  inputVis.style.display = (user.role === 'admin') ? '' : 'none';
  renderBmList();
  renderMemberList();
}

async function handleDataChanged() {
  // 데이터 변경 시 사이드바 갱신
  const bookmarks = dataService.getBookmarks();
  renderNav(bookmarks, { role: currentUser.role, email: currentUser.email });
}
