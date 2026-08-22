/**
 * 앱 엔트리포인트
 */
import { checkAuth, handleLogin, handleLogout, setAuthStateListener, getAuthState } from './auth/auth-guard.js';
import { getBookmarks } from './services/data-service.js';
import { initSidebar } from './ui/sidebar.js';
import { initBookmarkModal } from './ui/bookmark-modal.js';
import { initMemberManagement } from './ui/member-management.js';
import { initUsageManagement } from './ui/usage-management.js';
import { showToast } from './ui/toast.js';
import { initHoverCard } from './ui/hover-card.js';
import { appConfig } from './config/app.config.js';
import { logger } from './utils/logger.js';

/* ─── DOM ─── */
const loginWrap = document.getElementById('loginWrap');
const btnMsLogin = document.getElementById('btnMsLogin');
const loginError = document.getElementById('loginError');
const sidebar = document.getElementById('sidebar');
const btnLogout = document.getElementById('btnLogout');
const btnManager = document.getElementById('btnManager');
const btnToggle = document.getElementById('btnToggle');
const footerUser = document.getElementById('footerUser');
const modalOverlay = document.getElementById('modalOverlay');
const btnCloseModal = document.getElementById('btnCloseModal');
const contentFrame = document.getElementById('contentFrame');
const welcomeScreen = document.getElementById('welcomeScreen');
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const errorDomain = document.getElementById('errorDomain');
const btnOpenNew = document.getElementById('btnOpenNew');

/* ─── 상태 ─── */
let currentUrl = '';
let dynamicBlocked = [];
let pageCallId = 0;
let checkTimer = null;
let loadTimer = null;

/* ─── 화면 전환 ─── */
function hideAll() {
  welcomeScreen.style.display = 'none';
  errorScreen.style.display = 'none';
  loadingScreen.style.display = 'none';
  contentFrame.style.display = 'none';
}
function showWelcome() { hideAll(); welcomeScreen.style.display = 'flex'; }
function showError(url) { hideAll(); errorDomain.textContent = getHostname(url) || url; errorScreen.style.display = 'flex'; }
function showLoading() { hideAll(); loadingScreen.style.display = 'flex'; }
function showFrame() { hideAll(); contentFrame.style.display = 'block'; }

/* ─── 유틸 ─── */
function getHostname(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase(); }
  catch (e) { return ''; }
}

function isBlocked(url) {
  const h = getHostname(url);
  if (!h) return false;
  for (const d of appConfig.knownBlockedDomains) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  for (const d of dynamicBlocked) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  return false;
}

function addToDynamicBlocked(url) {
  const h = getHostname(url);
  if (h && !dynamicBlocked.includes(h)) {
    dynamicBlocked.push(h);
  }
}

/* ─── iframe 페이지 열기 ─── */
function clearChecks() {
  if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
  if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
  contentFrame.onload = null;
  contentFrame.onerror = null;
}

export function openPage(url) {
  clearChecks();
  pageCallId++;
  const myId = pageCallId;

  if (!url.startsWith('http')) url = 'https://' + url;
  currentUrl = url;

  if (isBlocked(url)) {
    contentFrame.src = 'about:blank';
    showError(url);
    return;
  }

  showLoading();
  const startTime = Date.now();

  contentFrame.onload = function () {
    if (myId !== pageCallId) return;
    clearChecks();
    const elapsed = Date.now() - startTime;
    try {
      const loc = contentFrame.contentWindow.location.href;
      if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
    } catch (e) { }
    if (elapsed < 200) {
      checkTimer = setTimeout(function () {
        if (myId !== pageCallId) return;
        try {
          const loc = contentFrame.contentWindow.location.href;
          if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
        } catch (e) { }
        showFrame();
      }, 300);
    } else {
      showFrame();
    }
  };

  contentFrame.onerror = function () {
    if (myId !== pageCallId) return;
    clearChecks(); addToDynamicBlocked(url); showError(url);
  };

  loadTimer = setTimeout(function () {
    if (myId !== pageCallId) return;
    clearChecks(); addToDynamicBlocked(url); showError(url);
  }, appConfig.iframeTimeout);

  contentFrame.src = url;
}

/* ─── CSP violation ─── */
document.addEventListener('securitypolicyviolation', function (e) {
  if (e.blockedURI && currentUrl) {
    const bh = getHostname(e.blockedURI);
    const ch = getHostname(currentUrl);
    if (bh === ch) { clearChecks(); addToDynamicBlocked(currentUrl); showError(currentUrl); }
  }
});

/* ─── 새 창 열기 ─── */
btnOpenNew.addEventListener('click', function () {
  if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
});

/* ─── 사이드바 토글 ─── */
const isMobile = () => window.innerWidth <= 768;

btnToggle.addEventListener('click', function () {
  if (isMobile()) {
    sidebar.classList.remove('collapsed');
    sidebar.classList.toggle('expanded');
  } else {
    sidebar.classList.remove('expanded');
    sidebar.classList.toggle('collapsed');
  }
});

/* ─── 모달 탭 전환 ─── */
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    const panelId = 'panel' + capitalize(tab.dataset.tab);
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = '';
  });
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─── 모달 열기/닫기 ─── */
btnManager.addEventListener('click', function () {
  const state = getAuthState();

  // 탭 초기화
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById('panelBookmarks').style.display = '';

  // Admin 전용 탭 표시
  document.getElementById('tabMembers').style.display = (state.role === 'admin') ? '' : 'none';
  document.getElementById('tabUsage').style.display = (state.role === 'admin') ? '' : 'none';

  modalOverlay.classList.add('show');

  // 각 모듈 렌더
  initBookmarkModal();
  if (state.role === 'admin') {
    initMemberManagement();
    initUsageManagement();
  }
});

btnCloseModal.addEventListener('click', () => modalOverlay.classList.remove('show'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('show');
});

/* ─── ESC 키 ─── */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const editOverlay = document.getElementById('editOverlay');
    if (editOverlay.classList.contains('show')) editOverlay.classList.remove('show');
    else if (modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
  }
});

/* ─── 로그인/로그아웃 ─── */
btnMsLogin.addEventListener('click', async function () {
  loginError.textContent = '';
  try {
    await handleLogin();
  } catch (error) {
    loginError.textContent = '로그인에 실패했습니다. 다시 시도해 주세요.';
    logger.error('Main', 'Login failed:', error);
  }
});

btnLogout.addEventListener('click', async function () {
  await handleLogout();
});

/* ─── 인증 상태 변경 콜백 ─── */
setAuthStateListener(async function (state) {
  if (state.isAuthenticated) {
    loginWrap.style.display = 'none';
    sidebar.style.display = 'flex';
    footerUser.textContent = state.displayName || state.email;
    document.body.classList.toggle('is-admin', state.role === 'admin');

    if (state.role === 'none') {
      showToast('이 팀에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.', 'error');
      showWelcome();
      return;
    }

    // 북마크 로드 + 사이드바 렌더
    try {
      const bookmarks = await getBookmarks(true);
      initSidebar(bookmarks, openPage, isBlocked, getHostname);
      initHoverCard(isBlocked, getHostname);
      showWelcome();
    } catch (error) {
      logger.error('Main', 'Failed to load bookmarks:', error);
      showToast('북마크를 불러오는데 실패했습니다.', 'error');
      showWelcome();
    }
  } else {
    loginWrap.style.display = 'flex';
    sidebar.style.display = 'none';
    document.body.classList.remove('is-admin');
    hideAll();
    contentFrame.src = 'about:blank';
  }
});

/* ─── 초기화 ─── */
async function init() {
  logger.info('Main', 'App initializing...');
  await checkAuth();
}

// DOM 및 동기 스크립트 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
