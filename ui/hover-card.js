/**
 * 호버 카드 UI
 */
const hoverCard = document.getElementById('hoverCard');
const hoverFav = document.getElementById('hoverFav');
const hoverName = document.getElementById('hoverName');
const hoverUrl = document.getElementById('hoverUrl');
const hoverDesc = document.getElementById('hoverDesc');
const hoverTag = document.getElementById('hoverTag');

let isBlockedFn = null;
let getHostnameFn = null;

/**
 * 호버 카드 초기화
 */
export function initHoverCard(isBlocked, getHostname) {
  isBlockedFn = isBlocked;
  getHostnameFn = getHostname;
}

/**
 * 호버 카드 표시
 */
export function showHoverCard(bm, targetEl) {
  const hostname = getHostnameFn ? getHostnameFn(bm.url) : '';

  hoverFav.src = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` : '';
  hoverFav.onerror = function () { this.style.display = 'none'; };
  hoverFav.style.display = 'inline-block';

  hoverName.textContent = bm.title;
  hoverUrl.textContent = hostname;
  hoverDesc.textContent = bm.description || '';

  if (isBlockedFn && isBlockedFn(bm.url)) {
    hoverTag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 새 창으로 열림';
  } else {
    hoverTag.textContent = '';
  }

  hoverCard.classList.add('show');
  positionHoverCard(targetEl);
}

/**
 * 호버 카드 숨김
 */
export function hideHoverCard() {
  hoverCard.classList.remove('show');
}

/**
 * 호버 카드 위치 계산
 */
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