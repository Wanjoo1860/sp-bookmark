/**
 * [ui/bookmark-modal.js]
 * 북마크 관리 UI (추가/편집/삭제/정렬)
 * ─────────────────────────────────────────
 * [대체 대상] 기존 renderBmList(), onUrlInput(), btnAddBm, openEditModal(), saveEdit()
 */
import { $ } from '../utils/dom-helpers.js';
import { faviconUrl, getHostname, isBlocked, handleImgError } from '../utils/url-helpers.js';
import { toast } from './toast.js';
import { openEditModalOverlay, closeEditModal } from './modal-controller.js';
import * as dataService from '../services/data-service.js';

const inputUrl = $('#inputUrl');
const inputName = $('#inputName');
const inputDesc = $('#inputDesc');
const inputVis = $('#inputVis');
const inputHint = $('#inputHint');
const previewFav = $('#previewFav');
const btnAddBm = $('#btnAddBm');
const bmSections = $('#bmSections');

const editUrl = $('#editUrl');
const editName = $('#editName');
const editDesc = $('#editDesc');
const editVis = $('#editVis');
const editFav = $('#editFav');
const editVisRow = $('#editVisRow');
const btnSaveEdit = $('#btnSaveEdit');

let currentUser = null;
let editingBm = null;
let onDataChanged = null;

export function initBookmarkModal(options) {
  currentUser = options.currentUser;
  onDataChanged = options.onDataChanged;

  // URL 입력 실시간 피드백
  inputUrl.addEventListener('input', onUrlInput);

  // 이름 입력 시 자동완성 플래그 해제
  inputName.addEventListener('input', function () {
    inputName.dataset.auto = 'false';
  });

  // 추가 버튼
  btnAddBm.addEventListener('click', handleAdd);

  // 편집 URL 입력 시 파비콘 업데이트
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

  // 편집 저장
  btnSaveEdit.addEventListener('click', handleSaveEdit);
}

export function renderBmList() {
  bmSections.innerHTML = '';
  const bookmarks = dataService.getBookmarks();

  if (currentUser.role === 'admin') {
    renderBmSection('공개', 'public', false, bookmarks);
    renderBmSection('관리자 전용', 'admin', false, bookmarks);
    renderBmSection('개인', 'private', true, bookmarks);
  } else {
    renderBmSection('내 북마크', 'private', true, bookmarks);
  }
}

export function setCurrentUser(user) {
  currentUser = user;
}

// ─── 내부 함수 ─── //

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

  if (isBlocked(full)) {
    inputHint.textContent = '\u26A0 이 사이트는 iframe 차단됨 (새 창에서 열림)';
    inputHint.style.color = '#f0883e';
  } else {
    inputHint.textContent = '';
    inputHint.style.color = '';
  }

  // 이름 자동완성: 사용자가 직접 수정한 적 없을 때만
  if (!inputName.value.trim() || inputName.dataset.auto === 'true') {
    const h = getHostname(full);
    if (h) {
      const readable = h.replace(/^www\./, '');
      // Punycode(xn--) 도메인은 자동완성하지 않음
      if (!readable.startsWith('xn--')) {
        inputName.value = readable;
        inputName.dataset.auto = 'true';
      }
    }
  }
}

async function handleAdd() {
  const url = inputUrl.value.trim();
  const name = inputName.value.trim();
  const desc = inputDesc.value.trim();
  if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }

  const full = url.startsWith('http') ? url : 'https://' + url;
  const vis = (currentUser.role === 'admin') ? inputVis.value : 'private';
  const bookmarks = dataService.getBookmarks();

  const bmData = {
    name: name,
    url: full,
    desc: desc,
    vis: vis,
    owner: currentUser.email,
    ord: bookmarks.length
  };

  // 디버그: 전송 데이터 확인 (문제 해결 후 제거 가능)
  console.log('[DEBUG] addBookmark 전송:', JSON.stringify(bmData, null, 2));

  try {
    await dataService.addBookmark(bmData);
    inputUrl.value = '';
    inputName.value = '';
    inputName.dataset.auto = 'false';
    inputDesc.value = '';
    inputHint.textContent = '';
    previewFav.style.display = 'none';
    renderBmList();
    if (onDataChanged) onDataChanged();
    toast('추가 완료');
  } catch (e) {
    // 에러 상세 출력
    console.error('[ERROR] addBookmark 실패:', e);
    if (e.body) console.error('[ERROR] 서버 응답:', JSON.stringify(e.body, null, 2));
    toast('추가 실패: ' + (e.message || '알 수 없는 오류'));
  }
}

function openEditModal(bm) {
  editingBm = bm;
  editUrl.value = bm.url;
  editName.value = bm.name;
  editDesc.value = bm.desc || '';
  editVis.value = bm.vis;
  editFav.src = faviconUrl(bm.url);
  editFav.style.display = 'inline-block';
  editFav.onerror = function () { this.style.display = 'none'; };
  editVisRow.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';
  openEditModalOverlay();
}

async function handleSaveEdit() {
  if (!editingBm) return;

  const url = editUrl.value.trim();
  const name = editName.value.trim();
  const desc = editDesc.value.trim();
  if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  const changes = { name, url: fullUrl, desc };
  if (currentUser.role === 'admin') {
    changes.vis = editVis.value;
  }

  try {
    await dataService.updateBookmark(editingBm.spId, changes);
    closeEditModal();
    editingBm = null;
    renderBmList();
    if (onDataChanged) onDataChanged();
    toast('수정 완료');
  } catch (e) {
    console.error('[ERROR] updateBookmark 실패:', e);
    if (e.body) console.error('[ERROR] 서버 응답:', JSON.stringify(e.body, null, 2));
    toast('수정 실패: ' + (e.message || '알 수 없는 오류'));
  }
}

function renderBmSection(label, vis, ownerOnly, bookmarks) {
  let items;
  if (ownerOnly) {
    items = bookmarks.filter(b => b.vis === vis && b.owner === currentUser.email);
  } else {
    items = bookmarks.filter(b => b.vis === vis);
  }
  items.sort((a, b) => (a.ord || 0) - (b.ord || 0));

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
    favicon.onerror = function () { handleImgError(this, bm.url, bm.name); };

    const infoWrap = document.createElement('div');
    infoWrap.className = 'bm-info-wrap';

    const info = document.createElement('span');
    info.className = 'bm-info';
    info.textContent = bm.name;

    const sub = document.createElement('span');
    sub.className = 'bm-sub';
    sub.textContent = getHostname(bm.url);

    infoWrap.appendChild(info);
    infoWrap.appendChild(sub);
    row.appendChild(favicon);
    row.appendChild(infoWrap);

    if (isBlocked(bm.url)) {
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      row.appendChild(tag);
    }

    // 편집 버튼
    const edit = document.createElement('button');
    edit.className = 'bm-btn';
    edit.title = '편집';
    edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    edit.addEventListener('click', function (e) { e.stopPropagation(); openEditModal(bm); });

    // 삭제 버튼
    const del = document.createElement('button');
    del.className = 'bm-btn bm-del';
    del.title = '삭제';
    del.textContent = '\u00D7';
    del.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm(bm.name + ' 을(를) 삭제하시겠습니까?')) return;
      try {
        await dataService.removeBookmark(bm.spId);
        renderBmList();
        if (onDataChanged) onDataChanged();
        toast('삭제 완료');
      } catch (err) {
        console.error('[ERROR] deleteBookmark 실패:', err);
        toast('삭제 실패');
      }
    });

    row.appendChild(edit);
    row.appendChild(del);

    // 드래그앤드롭
    row.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', bm.id);
      e.dataTransfer.setData('text/vis', vis);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
    row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
    row.addEventListener('drop', function (e) {
      e.preventDefault();
      row.classList.remove('drag-over');
      const dragId = e.dataTransfer.getData('text/plain');
      const dragVis = e.dataTransfer.getData('text/vis');
      if (dragVis !== vis || dragId === bm.id) return;
      handleReorder(dragId, bm.id, vis, ownerOnly, bookmarks);
    });

    list.appendChild(row);
  });

  block.appendChild(list);
  bmSections.appendChild(block);
}

async function handleReorder(dragId, targetId, vis, ownerOnly, bookmarks) {
  let sectionItems;
  if (ownerOnly) {
    sectionItems = bookmarks.filter(b => b.vis === vis && b.owner === currentUser.email).sort((a, b) => (a.ord || 0) - (b.ord || 0));
  } else {
    sectionItems = bookmarks.filter(b => b.vis === vis).sort((a, b) => (a.ord || 0) - (b.ord || 0));
  }

  const dragIdx = sectionItems.findIndex(b => b.id === dragId);
  const targetIdx = sectionItems.findIndex(b => b.id === targetId);
  if (dragIdx === -1 || targetIdx === -1) return;

  const [moved] = sectionItems.splice(dragIdx, 1);
  sectionItems.splice(targetIdx, 0, moved);

  const reorderData = sectionItems.map((b, i) => ({ spId: b.spId, ord: i }));

  try {
    await dataService.reorderBookmarks(reorderData);
    renderBmList();
    if (onDataChanged) onDataChanged();
  } catch (e) {
    console.error('[ERROR] reorder 실패:', e);
    toast('정렬 저장 실패');
  }
}
