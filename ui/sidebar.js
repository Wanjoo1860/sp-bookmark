/**
 * 사이드바 네비게이션 렌더링
 */
import { getAuthState } from '../auth/auth-guard.js';
import { appConfig } from '../config/app.config.js';
import { VISIBILITY, MULTI_TLDS } from '../utils/constants.js';
import { showHoverCard, hideHoverCard } from './hover-card.js';

const navList = document.getElementById('navList');
const sidebar = document.getElementById('sidebar');

let hoverTimer = null;
let currentOpenPage = null;
let currentIsBlocked = null;
let currentGetHostname = null;

/**
 * 사이드바 초기화
 */
export function initSidebar(bookmarks, openPageFn, isBlockedFn, getHostnameFn) {
  currentOpenPage = openPageFn;
  currentIsBlocked = isBlockedFn;
  currentGetHostname = getHostnameFn;
  renderNav(bookmarks);
}

/**
 * 사이드바 리렌더
 */
export function refreshSidebar(bookmarks) {
  renderNav(bookmarks);
}

/**
 * 네비게이션 렌더링
 */
function renderNav(bookmarks) {
  navList.innerHTML = '';
  const state = getAuthState();

  const pubItems = bookmarks.filter(b => b.visibility === VISIBILITY.PUBLIC);
  const admItems = bookmarks.filter(b => b.visibility === VISIBILITY.ADMIN && state.role === 'admin');
  const privItems = bookmarks.filter(b =>
    b.visibility === VISIBILITY.PRIVATE && b.owner?.toLowerCase() === state.email?.toLowerCase()
  );

  makeSection('공개', pubItems, 'sec-public');
  makeSection('관리자', admItems, 'sec-admin');
  makeSection('개인', privItems, 'sec-private');
}

/**
 * 섹션 생성
 */
function makeSection(label, items, cls) {
  if (items.length === 0) return;

  const sec = document.createElement('div');
  sec.className = 'nav-section ' + cls;

  const lbl = document.createElement('div');
  lbl.className = 'nav-section-label';
  lbl.textContent = label;
  sec.appendChild(lbl);

  items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  items.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.id = bm.id;

    const icon = document.createElement('img');
    icon.className = 'nav-icon';
    icon.src = faviconUrl(bm.url);
    icon.alt = '';
    icon.onerror = function () { handleImgError(this, bm.url, bm.title); };

    const name = document.createElement('span');
    name.className = 'nav-name';
    name.textContent = bm.title;

    item.appendChild(icon);
    item.appendChild(name);

    if (bm.visibility === VISIBILITY.ADMIN) {
      const badge = document.createElement('span');
      badge.className = 'adm-badge';
      badge.textContent = 'ADM';
      item.appendChild(badge);
    }

    if (currentIsBlocked(bm.url)) {
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      item.appendChild(tag);
    }

    item.addEventListener('click', function () {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      currentOpenPage(bm.url);

      // 모바일: 사이드바 닫기
      if (window.innerWidth <= 768 && sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
      }
    });

    item.addEventListener('mouseenter', function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showHoverCard(bm, item), appConfig.hoverDelay);
    });

    item.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
      hideHoverCard();
    });

    sec.appendChild(item);
  });

  navList.appendChild(sec);
}

/* ─── 유틸 ─── */
export function faviconUrl(url, sz) {
  const h = currentGetHostname ? currentGetHostname(url) : '';
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=${sz || 64}` : '';
}

export function extractSiteName(hostname) {
  let h = hostname.replace(/^www\./, '');
  const parts = h.split('.');
  let siteName = '';

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_TLDS.includes(lastTwo) && parts.length >= 3) {
    siteName = parts[parts.length - 3];
  } else if (parts.length >= 2) {
    siteName = parts[parts.length - 2];
  } else {
    siteName = parts[0];
  }

  return siteName.charAt(0).toUpperCase() + siteName.slice(1);
}

function fallbackIcon(name) {
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl(${hue},55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function handleImgError(img, url, name) {
  const h = currentGetHostname ? currentGetHostname(url) : '';
  if (!img.dataset.retry) {
    img.dataset.retry = '1';
    img.src = `https://icons.duckduckgo.com/ip3/${h}.ico`;
    return;
  }
  if (img.dataset.retry === '1') {
    img.dataset.retry = '2';
    img.src = fallbackIcon(name || h);
    return;
  }
  img.style.display = 'none';
}
