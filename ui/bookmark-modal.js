/**
 * 즐겨찾기 관리 모달 (탭 1)
 */
import { getAuthState } from '../auth/auth-guard.js';
import { getBookmarks, addBookmark, editBookmark, removeBookmark, reorderBookmarks, getAllBookmarksUnfiltered } from '../services/data-service.js';
import { canUpdateBookmark, canDeleteBookmark, canChangeVisibility, getVisibilityOptions } from '../services/permission-service.js';
import { refreshSidebar, faviconUrl, extractSiteName } from './sidebar.js';
import { showToast } from './toast.js';
import { appConfig } from '../config/app.config.js';
import { VISIBILITY } from '../utils/constants.js';

/* ─── DOM ─── */
const inputUrl = document.getElementById('inputUrl');
const inputName = document.getElementById('inputName');
const inputDesc = document.getElementById('inputDesc');
const inputVis = document.getElementById('inputVis');
const inputHint = document.getElementById('inputHint');
const previewFav = document.getElementById('previewFav');
const btnAddBm = document.getElementById('btnAddBm');
const bmSections = document.getElementById('bmSections');
const visRow = document.getElementById('visRow');

// 편집 모달
const editOverlay = document.getElementById('editOverlay');
const btnCloseEdit = document.getElementById('btnCloseEdit');
const editUrl = document.getElementById('editUrl');
const editName = document.getElementById('editName');
const editDesc = document.getElementById('editDesc');
const editVis = document.getElementById('editVis');
const editFav = document.getElementById('editFav');
const btnSaveEdit = document.getElementById('btnSaveEdit');
const editVisRow = document.getElementById('editVisRow');

let editingId = null;
let allBookmarks = [];
let urlDebounce = null;

/**
 * 즐겨찾기 모달 초기화
 */
export async function initBookmarkModal() {
  const state = getAuthState();

  // Visibility 옵션 설정
  const options = getVisibilityOptions();
  inputVis.innerHTML = '';
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    inputVis.appendChild(el);
  });

  if (!canChangeVisibility()) {
    inputVis.style.display = 'none';
  } else {
    inputVis.style.display = '';
  }

  // 북마크 로드
  try {
    if (state.role === 'admin') {
      allBookmarks = await getAllBookmarksUnfiltered(true);
    } else {
      allBookmarks = await getBookmarks(true);
    }
    renderBmList();
  } catch (error) {
    showToast('북마크를 불러오는데 실패했습니다.', 'error');
  }
}

/* ─── URL 입력 이벤트 ─── */
inputUrl.addEventListener('input', onUrlInput);
inputUrl.addEventListener('paste', function () {
  setTimeout(() => {
    const url = inputUrl.value.trim();
    if (!url) return;
    const full = url.startsWith('http') ? url : 'https://' + url;
    if (!inputName.value.trim()) {
      const h = getHostnameLocal(full);
      if (h && h.includes('.')) {
        inputName.value = extractSiteName(h);
      }
    }
  }, 0);
});

function onUrlInput() {
  const url = inputUrl.value.trim();
  if (!url) {
    previewFav.style.display = 'none';
    inputHint.textContent = '';
    return;
  }
  const full = url.startsWith('http') ? url : 'https://' + url;
  previewFav.src = faviconUrl(full);
  previewFav.style.display = 'inline-block';
  previewFav.onerror = function () { this.style.display = 'none'; };

  if (isBlockedLocal(full)) {
    inputHint.textContent = '\u26A0 이 사이트는 iframe 차단됨 (새 창에서 열림)';
    inputHint.style.color = '#f0883e';
  } else {
    inputHint.textContent = '';
    inputHint.style.color = '';
  }

  clearTimeout(urlDebounce);
  urlDebounce = setTimeout(function () {
    if (!inputName.value.trim()) {
      const h = getHostnameLocal(full);
      if (h && h.includes('.')) {
        inputName.value = extractSiteName(h);
      }
    }
  }, 500);
}

/* ─── 북마크 추가 ─── */
btnAddBm.addEventListener('click', async function () {
  const url = inputUrl.value.trim();
  const name = inputName.value.trim();
  const desc = inputDesc.value.trim();

  if (!url || !name) { showToast('URL과 이름을 입력하세요'); return; }

  const state = getAuthState();
  const visibility = canChangeVisibility() ? inputVis.value : 'private';

  try {
    const maxOrder = allBookmarks
      .filter(b => b.visibility === visibility)
      .reduce((max, b) => Math.max(max, b.sortOrder || 0), -1);

    await addBookmark({
      title: name,
      url: url,
      description: desc,
      visibility: visibility,
      sortOrder: maxOrder + 1
    });

    inputUrl.value = '';
    inputName.value = '';
    inputDesc.value = '';
    inputHint.textContent = '';
    previewFav.style.display = 'none';

    await refreshAll();
    showToast('추가 완료', 'success');
  } catch (error) {
    showToast('추가 실패: ' + error.message, 'error');
  }
});

/* ─── 북마크 목록 렌더 ─── */
function renderBmList() {
  bmSections.innerHTML = '';
  const state = getAuthState();

  if (state.role === 'admin') {
    renderBmSection('공개', VISIBILITY.PUBLIC, false);
    renderBmSection('관리자 전용', VISIBILITY.ADMIN, false);
    renderBmSection('개인', VISIBILITY.PRIVATE, true);
  } else {
    renderBmSection('내 북마크', VISIBILITY.PRIVATE, true);
  }
}

function renderBmSection(label, vis, ownerOnly) {
  const state = getAuthState();

  let items;
  if (ownerOnly && state.role !== 'admin') {
    items = allBookmarks.filter(b => b.visibility === vis && b.owner?.toLowerCase() === state.email?.toLowerCase());
  } else {
    items = allBookmarks.filter(b => b.visibility === vis);
  }
  items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const block = document.createElement('div');
  block.className = 'bm-block';

  const header = document.createElement('div');
  header.className = 'bm-block-header bm-block-' + vis;
  header.innerHTML = '<span class="bm-block-dot"></span> ' + label;
  block.appendChild(header);

  const list = document.createElement('div');
  list.className = 'bm-block-list';

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bm-empty';
    empty.textContent = '등록된 항목이 없습니다.';
    list.appendChild(empty);
  }

  items.forEach(bm => {
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.draggable = true;
    row.dataset.id = bm.id;
    row.dataset.vis = vis;

    const favicon = document.createElement('img');
    favicon.className = 'bm-favicon';
    favicon.src = faviconUrl(bm.url, 32);
    favicon.alt = '';
    favicon.onerror = function () { this.style.display = 'none'; };

    const infoWrap = document.createElement('div');
    infoWrap.className = 'bm-info-wrap';

    const info = document.createElement('span');
    info.className = 'bm-info';
    info.textContent = bm.title;

    const sub = document.createElement('span');
    sub.className = 'bm-sub';
    sub.textContent = getHostnameLocal(bm.url);

    infoWrap.appendChild(info);
    infoWrap.appendChild(sub);

    row.appendChild(favicon);
    row.appendChild(infoWrap);

    if (isBlockedLocal(bm.url)) {
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      row.appendChild(tag);
    }

    // 편집 버튼
    if (canUpdateBookmark(bm)) {
      const edit = document.createElement('button');
      edit.className = 'bm-btn';
      edit.title = '편집';
      edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      edit.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(bm); });
      row.appendChild(edit);
    }

    // 삭제 버튼
    if (canDeleteBookmark(bm)) {
      const del = document.createElement('button');
      del.className = 'bm-btn bm-del';
      del.title = '삭제';
      del.textContent = '\u00D7';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(bm.title + ' 을(를) 삭제하시겠습니까?')) return;
        try {
          await removeBookmark(bm.id);
          await refreshAll();
          showToast('삭제 완료', 'success');
        } catch (error) {
          showToast('삭제 실패: ' + error.message, 'error');
        }
      });
      row.appendChild(del);
    }

    // 드래그앤드롭
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', bm.id);
      e.dataTransfer.setData('text/vis', vis);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const dragId = e.dataTransfer.getData('text/plain');
      const dragVis = e.dataTransfer.getData('text/vis');
      if (dragVis !== vis || dragId === bm.id) return;
      await handleReorder(dragId, bm.id, vis, ownerOnly);
    });

    list.appendChild(row);
  });

  block.appendChild(list);
  bmSections.appendChild(block);
}

/* ─── 드래그앤드롭 정렬 ─── */
async function handleReorder(dragId, targetId, vis, ownerOnly) {
  const state = getAuthState();

  let sectionItems;
  if (ownerOnly && state.role !== 'admin') {
    sectionItems = allBookmarks.filter(b => b.visibility === vis && b.owner?.toLowerCase() === state.email?.toLowerCase());
  } else {
    sectionItems = allBookmarks.filter(b => b.visibility === vis);
  }
  sectionItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const dragIdx = sectionItems.findIndex(b => b.id === dragId);
  const targetIdx = sectionItems.findIndex(b => b.id === targetId);
  if (dragIdx === -1 || targetIdx === -1) return;

  const [moved] = sectionItems.splice(dragIdx, 1);
  sectionItems.splice(targetIdx, 0, moved);

  const orderUpdates = sectionItems.map((b, i) => ({ itemId: b.id, sortOrder: i }));

  try {
    await reorderBookmarks(orderUpdates);
    await refreshAll();
  } catch (error) {
    showToast('정렬 저장 실패', 'error');
  }
}

/* ─── 편집 모달 ─── */
function openEditModal(bm) {
  editingId = bm.id;
  editUrl.value = bm.url;
  editName.value = bm.title;
  editDesc.value = bm.description || '';
  editVis.value = bm.visibility;
  editFav.src = faviconUrl(bm.url);
  editFav.style.display = 'inline-block';
  editFav.onerror = function () { this.style.display = 'none'; };

  if (canChangeVisibility()) {
    editVis.style.display = '';
  } else {
    editVis.style.display = 'none';
  }
  editVisRow.style.display = 'flex';
  editOverlay.classList.add('show');
}

btnCloseEdit.addEventListener('click', () => { editOverlay.classList.remove('show'); editingId = null; });
editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) { editOverlay.classList.remove('show'); editingId = null; } });

editUrl.addEventListener('input', function () {
  const url = editUrl.value.trim();
  if (url) {
    const full = url.startsWith('http') ? url : 'https://' + url;
    editFav.src = faviconUrl(full);
    editFav.style.display = 'inline-block';
  } else {
    editFav.style.display = 'none';
  }
});

btnSaveEdit.addEventListener('click', async function () {
  if (!editingId) return;

  const url = editUrl.value.trim();
  const name = editName.value.trim();
  const desc = editDesc.value.trim();

  if (!url || !name) { showToast('URL과 이름을 입력하세요'); return; }

  const updates = { title: name, url: url, description: desc };
  if (canChangeVisibility()) {
    updates.visibility = editVis.value;
  }

  try {
    await editBookmark(editingId, updates);
    editOverlay.classList.remove('show');
    editingId = null;
    await refreshAll();
    showToast('수정 완료', 'success');
  } catch (error) {
    showToast('수정 실패: ' + error.message, 'error');
  }
});

/* ─── 새로고침 ─── */
async function refreshAll() {
  const state = getAuthState();
  if (state.role === 'admin') {
    allBookmarks = await getAllBookmarksUnfiltered(true);
  } else {
    allBookmarks = await getBookmarks(true);
  }
  renderBmList();

  const visibleBookmarks = await getBookmarks(true);
  refreshSidebar(visibleBookmarks);
}

/* ─── 로컬 유틸 ─── */
function getHostnameLocal(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase(); }
  catch (e) { return ''; }
}

function isBlockedLocal(url) {
  const h = getHostnameLocal(url);
  if (!h) return false;
  for (const d of appConfig.knownBlockedDomains) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  return false;
}
