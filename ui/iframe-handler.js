/**
 * [ui/iframe-handler.js]
 * iframe 페이지 로딩/에러/차단 처리
 * ─────────────────────────────────────────
 * [대체 대상] 기존 openPage(), clearChecks(), showWelcome/Error/Loading/Frame()
 */
import { $ } from '../utils/dom-helpers.js';
import { isBlocked, getHostname, addToDynamicBlocked } from '../utils/url-helpers.js';
import { TIMERS } from '../config/app.config.js';

const contentFrame = $('#contentFrame');
const welcomeScreen = $('#welcomeScreen');
const errorScreen = $('#errorScreen');
const loadingScreen = $('#loadingScreen');
const errorDomain = $('#errorDomain');
const btnOpenNew = $('#btnOpenNew');

let currentUrl = '';
let checkTimer = null;
let loadTimer = null;
let pageCallId = 0;

export function getCurrentUrl() { return currentUrl; }

function hideAll() {
  welcomeScreen.style.display = 'none';
  errorScreen.style.display = 'none';
  loadingScreen.style.display = 'none';
  contentFrame.style.display = 'none';
}

export function showWelcome() { hideAll(); welcomeScreen.style.display = 'flex'; }
function showError(url) { hideAll(); errorDomain.textContent = getHostname(url) || url; errorScreen.style.display = 'flex'; }
function showLoading() { hideAll(); loadingScreen.style.display = 'flex'; }
function showFrame() { hideAll(); contentFrame.style.display = 'block'; }

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
    } catch (e) { /* cross-origin OK */ }

    if (elapsed < 200) {
      checkTimer = setTimeout(function () {
        if (myId !== pageCallId) return;
        try {
          const loc = contentFrame.contentWindow.location.href;
          if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
        } catch (e) { /* cross-origin OK */ }
        showFrame();
      }, TIMERS.IFRAME_CHECK_DELAY);
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
  }, TIMERS.IFRAME_TIMEOUT);

  contentFrame.src = url;
}

export function initIframeHandler() {
  // 새 창 열기
  btnOpenNew.addEventListener('click', function () {
    if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
  });

  // CSP violation 감지
  document.addEventListener('securitypolicyviolation', function (e) {
    if (e.blockedURI && currentUrl) {
      const bh = getHostname(e.blockedURI);
      const ch = getHostname(currentUrl);
      if (bh === ch) { clearChecks(); addToDynamicBlocked(currentUrl); showError(currentUrl); }
    }
  });
}
