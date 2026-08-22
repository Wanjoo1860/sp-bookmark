/**
 * 사용 내역 관리 (탭 3 — Admin 전용)
 */
import { getUserBookmarkStats, removeUserBookmarks } from '../services/data-service.js';
import { showToast } from './toast.js';
import { logger } from '../utils/logger.js';

const root = document.getElementById('usageManagementRoot');

/**
 * 사용 내역 초기화
 */
export async function initUsageManagement() {
  root.innerHTML = '<div class="loading-inline"><div class="loading-spinner-sm"></div> 로딩 중...</div>';

  try {
    const stats = await getUserBookmarkStats();
    render(stats);
  } catch (error) {
    logger.error('UsageMgmt', 'Init failed:', error);
    root.innerHTML = '<p class="error-text">사용 내역을 불러오는데 실패했습니다.</p>';
  }
}

/**
 * 렌더링
 */
function render(stats) {
  root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'usage-header';
  header.innerHTML = `
    <h4 class="form-title">사용자별 개인 북마크 현황</h4>
    <span class="usage-summary">${stats.length}명이 개인 북마크를 사용 중</span>
  `;
  root.appendChild(header);

  if (stats.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bm-empty';
    empty.textContent = '개인 북마크를 등록한 사용자가 없습니다.';
    root.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'usage-list';

  stats.sort((a, b) => b.count - a.count);

  stats.forEach(stat => {
    const item = document.createElement('div');
    item.className = 'usage-item';

    const initial = (stat.email || '?').charAt(0).toUpperCase();

    item.innerHTML = `
      <div class="usage-user">
        <div class="user-avatar role-user">${initial}</div>
        <div class="usage-user-info">
          <div class="usage-user-email">${escHtml(stat.email)}</div>
          <div class="usage-user-count">개인 북마크 <strong>${stat.count}</strong>개</div>
        </div>
      </div>
      <div class="usage-actions">
        <button class="btn-expand" title="상세 보기">▼</button>
        <button class="btn-user-del">일괄 삭제</button>
      </div>
    `;

    // 상세 보기 (펼치기/접기)
    const expandBtn = item.querySelector('.btn-expand');
    let detailEl = null;

    expandBtn.addEventListener('click', () => {
      if (detailEl) {
        detailEl.remove();
        detailEl = null;
        expandBtn.textContent = '▼';
        return;
      }

      detailEl = document.createElement('div');
      detailEl.className = 'usage-detail';

      stat.bookmarks.forEach(bm => {
        const row = document.createElement('div');
        row.className = 'usage-detail-row';
        row.innerHTML = `
          <span class="usage-detail-title">${escHtml(bm.title)}</span>
          <span class="usage-detail-url">${escHtml(getHostname(bm.url))}</span>
        `;
        detailEl.appendChild(row);
      });

      item.appendChild(detailEl);
      expandBtn.textContent = '▲';
    });

    // 일괄 삭제
    const delBtn = item.querySelector('.btn-user-del');
    delBtn.addEventListener('click', async () => {
      if (!confirm(`"${stat.email}"의 개인 북마크 ${stat.count}개를 모두 삭제하시겠습니까?`)) return;
      try {
        delBtn.disabled = true;
        delBtn.textContent = '삭제 중...';
        const result = await removeUserBookmarks(stat.email);
        if (result.failed > 0) {
          showToast(`"${stat.email}" 북마크 ${result.deleted}개 삭제, ${result.failed}개 실패`, 'warning');
        } else {
          showToast(`"${stat.email}" 개인 북마크 ${result.deleted}개 삭제 완료`, 'success');
        }
        await initUsageManagement();
      } catch (error) {
        showToast('삭제 실패: ' + error.message, 'error');
        delBtn.disabled = false;
        delBtn.textContent = '일괄 삭제';
      }
    });

    list.appendChild(item);
  });

  root.appendChild(list);
}

/* ─── 유틸 ─── */
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function getHostname(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase(); }
  catch (e) { return ''; }
}
