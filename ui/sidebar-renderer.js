/**
 * [ui/sidebar-renderer.js]
 * 사이드바 네비게이션 렌더링 및 토글
 * ─────────────────────────────────────────
 * [대체 대상] 기존 renderNav(), 사이드바 토글 이벤트
 */
import { $ } from '../utils/dom-helpers.js';
import { faviconUrl, isBlocked, handleImgError } from '../utils/url-helpers.js';
import { TIMERS } from '../config/app.config.js';
import { showHoverCard, hideHoverCard } from './hover-card.js';
import { openPage } from './iframe-handler.js';

const sidebar = $('#sidebar');
const btnToggle = $('#btnToggle');
const navList = $('#navList');

let hoverTimer = null;

const isMobile = () => window.innerWidth <= 768;

export function initSidebar() {
  btnToggle.addEventListener('click', function () {
    if (isMobile()) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.toggle('expanded');
    } else {
      sidebar.classList.remove('expanded');
      sidebar.classList.toggle('collapsed');
    }
  });

  navList.addEventListener('click', function () {
    if (isMobile() && sidebar.classList.contains('expanded')) {
      sidebar.classList.remove('expanded');
    }
  });
}

/**
 * 사이드바 렌더링
 * @param {Array} bookmarks - 전체 북마크 배열
 * @param {Object} currentUser - {id, role, email}
 */
export function renderNav(bookmarks, currentUser) {
  navList.innerHTML = '';

  const visible = (bm) => {
    if (bm.vis === 'public') return true;
    if (bm.vis === 'admin' && currentUser.role === 'admin') return true;
    if (bm.vis === 'private' && bm.owner === currentUser.email) return true;
    return false;
  };

  const visibleBms = bookmarks.filter(visible);
  const pubItems = visibleBms.filter(b => b.vis === 'public');
  const admItems = visibleBms.filter(b => b.vis === 'admin');
  const privItems = visibleBms.filter(b => b.vis === 'private');

  makeSection('공개', pubItems, 'sec-public');
  makeSection('관리자', admItems, 'sec-admin');
  makeSection('개인', privItems, 'sec-private');
}

function makeSection(label, items, cls) {
  if (items.length === 0) return;

  const sec = document.createElement('div');
  sec.className = 'nav-section ' + cls;

  const lbl = document.createElement('div');
  lbl.className = 'nav-section-label';
  lbl.textContent = label;
  sec.appendChild(lbl);

  items.sort((a, b) => (a.ord || 0) - (b.ord || 0));

  items.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.id = bm.id;

    const icon = document.createElement('img');
    icon.className = 'nav-icon';
    icon.src = faviconUrl(bm.url);
    icon.alt = '';
    icon.onerror = function () { handleImgError(this, bm.url, bm.name); };

    const name = document.createElement('span');
    name.className = 'nav-name';
    name.textContent = bm.name;

    item.appendChild(icon);
    item.appendChild(name);

    if (bm.vis === 'admin') {
      const badge = document.createElement('span');
      badge.className = 'adm-badge';
      badge.textContent = 'ADM';
      item.appendChild(badge);
    }

    if (isBlocked(bm.url)) {
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      item.appendChild(tag);
    }

    item.addEventListener('click', function () {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      openPage(bm.url);
    });

    item.addEventListener('mouseenter', function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showHoverCard(bm, item), TIMERS.HOVER_DELAY);
    });

    item.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
      hideHoverCard();
    });

    sec.appendChild(item);
  });

  navList.appendChild(sec);
}
