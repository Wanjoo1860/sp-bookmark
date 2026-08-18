/**
 * [ui/hover-card.js]
 * 네비게이션 아이템 호버 카드
 * ─────────────────────────────────────────
 * [대체 대상] 기존 showHoverCard(), hideHoverCard(), positionHoverCard()
 */
import { $ } from '../utils/dom-helpers.js';
import { faviconUrl, getHostname, isBlocked } from '../utils/url-helpers.js';

const hoverCard = $('#hoverCard');
const hoverFav = $('#hoverFav');
const hoverName = $('#hoverName');
const hoverUrl = $('#hoverUrl');
const hoverDesc = $('#hoverDesc');
const hoverTag = $('#hoverTag');

export function showHoverCard(bm, targetEl) {
  hoverFav.src = faviconUrl(bm.url);
  hoverFav.onerror = function () { this.style.display = 'none'; };
  hoverFav.style.display = 'inline-block';
  hoverName.textContent = bm.name;
  hoverUrl.textContent = getHostname(bm.url);
  hoverDesc.textContent = bm.desc || '';

  if (isBlocked(bm.url)) {
    hoverTag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 새 창으로 열림';
  } else {
    hoverTag.textContent = '';
  }

  hoverCard.classList.add('show');
  positionHoverCard(targetEl);
}

export function hideHoverCard() {
  hoverCard.classList.remove('show');
}

function positionHoverCard(el) {
  const r = el.getBoundingClientRect();
  const cardW = hoverCard.offsetWidth;
  const cardH = hoverCard.offsetHeight;
  let left = r.right + 10;
  let top = r.top + r.height / 2 - cardH / 2;
  if (left + cardW > window.innerWidth - 10) left = r.left - cardW - 10;
  if (top < 5) top = 5;
  if (top + cardH > window.innerHeight - 5) top = window.innerHeight - cardH - 5;
  hoverCard.style.left = left + 'px';
  hoverCard.style.top = top + 'px';
}
