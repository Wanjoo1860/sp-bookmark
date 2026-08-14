// ============================================================
// 즐겨찾기 포털 - 메인 앱 로직
// ============================================================
;(function(){
'use strict';

/* ─── 상수 ─── */
const KNOWN_BLOCKED = [
  'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
  'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
  'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
  'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
  'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
  'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
  'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
  'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
];

/* ─── 상태 ─── */
let currentUrl     = '';
let dynamicBlocked = [];
let checkTimer     = null;
let loadTimer      = null;
let pageCallId     = 0;
let hoverTimer     = null;
let editingItem    = null;

/* ─── DOM ─── */
const $ = s => document.querySelector(s);
const sidebar       = $('#sidebar');
const btnToggle     = $('#btnToggle');
const btnManager    = $('#btnManager');
const btnLogout     = $('#btnLogout');
const navList       = $('#navList');
const contentFrame  = $('#contentFrame');
const welcomeScreen = $('#welcomeScreen');
const errorScreen   = $('#errorScreen');
const loadingScreen = $('#loadingScreen');
const errorDomain   = $('#errorDomain');
const btnOpenNew    = $('#btnOpenNew');
const modalOverlay  = $('#modalOverlay');
const btnCloseModal = $('#btnCloseModal');
const inputUrl      = $('#inputUrl');
const inputName     = $('#inputName');
const inputDesc     = $('#inputDesc');
const inputCategory = $('#inputCategory');
const inputVis      = $('#inputVis');
const inputSortOrder= $('#inputSortOrder');
const inputHint     = $('#inputHint');
const previewFav    = $('#previewFav');
const btnAddBm      = $('#btnAddBm');
const bmSections    = $('#bmSections');
const formTitle     = $('#formTitle');
const visRow        = $('#visRow');

// 호버 카드
const hoverCard = $('#hoverCard');
const hoverFav  = $('#hoverFav');
const hoverName = $('#hoverName');
const hoverUrl  = $('#hoverUrl');
const hoverDesc = $('#hoverDesc');
const hoverTag  = $('#hoverTag');

// 편집 모달
const editOverlay  = $('#editOverlay');
const btnCloseEdit = $('#btnCloseEdit');
const editUrl      = $('#editUrl');
const editName     = $('#editName');
const editDesc     = $('#editDesc');
const editCategory = $('#editCategory');
const editVis      = $('#editVis');
const editSortOrder= $('#editSortOrder');
const editFav      = $('#editFav');
const btnSaveEdit  = $('#btnSaveEdit');
const editVisRow   = $('#editVisRow');

// 탭
const panelBookmarks = $('#panelBookmarks');
const panelUsers     = $('#panelUsers');
const tabUsers       = $('#tabUsers');

// 관리자 관리
const inputAdminSearch = $('#inputAdminSearch');
const btnSearchUser    = $('#btnSearchUser');
const searchResults    = $('#searchResults');
const adminList        = $('#adminList');
const btnRefreshAdmins = $('#btnRefreshAdmins');

// 토스트
const toastEl = $('#toastMsg');

/* ─── Graph API 헬퍼 ─── */
async function graphGet(url) {
    var token = await getToken();
    var resp = await fetch(url, {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly'
        }
    });
    if (!resp.ok) {
        var text = await resp.text();
        throw new Error('HTTP ' + resp.status + ': ' + text);
    }
    return resp.json();
}

async function graphPost(url, body) {
    var token = await getToken();
    var resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!resp.ok && resp.status !== 204) {
        var text = await resp.text();
        throw new Error('HTTP ' + resp.status + ': ' + text);
    }
    if (resp.status === 204) return {};
    return resp.json();
}

async function graphPatch(url, body) {
    var token = await getToken();
    var resp = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!resp.ok && resp.status !== 204) {
        var text = await resp.text();
        throw new Error('HTTP ' + resp.status + ': ' + text);
    }
    if (resp.status === 204) return {};
    return resp.json();
}

async function graphDelete(url) {
    var token = await getToken();
    var resp = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok && resp.status !== 204) {
        var text = await resp.text();
        throw new Error('HTTP ' + resp.status + ': ' + text);
    }
}

/* ─── 유틸 ─── */
function getHostname(url){
  try{ return new URL(url.startsWith('http') ? url : 'https://'+url).hostname.toLowerCase(); }
  catch(e){ return ''; }
}

function isBlocked(url){
  const h = getHostname(url);
  if(!h) return false;
  for(const d of KNOWN_BLOCKED){
    if(h === d || h.endsWith('.'+d)) return true;
  }
  for(const d of dynamicBlocked){
    if(h === d || h.endsWith('.'+d)) return true;
  }
  return false;
}

function addToDynamicBlocked(url){
  const h = getHostname(url);
  if(h && !dynamicBlocked.includes(h)){
    dynamicBlocked.push(h);
    try { localStorage.setItem('portal_blocked', JSON.stringify(dynamicBlocked)); } catch(e){}
  }
}

function faviconUrl(url, sz){
  const h = getHostname(url);
  return h ? 'https://www.google.com/s2/favicons?domain='+h+'&sz='+(sz||64) : '';
}

function fallbackIcon(name){
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl('+hue+',55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">'+ch+'</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function handleImgError(img, url, name){
  const h = getHostname(url);
  if(!img.dataset.retry){
    img.dataset.retry = '1';
    img.src = 'https://icons.duckduckgo.com/ip3/'+h+'.ico';
    return;
  }
  if(img.dataset.retry === '1'){
    img.dataset.retry = '2';
    img.src = fallbackIcon(name || h);
    return;
  }
  img.style.display = 'none';
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

function escHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ─── 화면 전환 ─── */
function hideAll(){
  welcomeScreen.style.display = 'none';
  errorScreen.style.display   = 'none';
  loadingScreen.style.display = 'none';
  contentFrame.style.display  = 'none';
}
function showWelcome(){ hideAll(); welcomeScreen.style.display = 'flex'; }
function showError(url){ hideAll(); errorDomain.textContent = getHostname(url) || url; errorScreen.style.display = 'flex'; }
function showLoading(){ hideAll(); loadingScreen.style.display = 'flex'; }
function showFrame(){ hideAll(); contentFrame.style.display = 'block'; }

/* ─── iframe 체크 ─── */
function clearChecks(){
  if(checkTimer){ clearTimeout(checkTimer); checkTimer = null; }
  if(loadTimer){ clearTimeout(loadTimer); loadTimer = null; }
  contentFrame.onload  = null;
  contentFrame.onerror = null;
}

/* ─── 페이지 열기 ─── */
function openPage(url){
  clearChecks();
  pageCallId++;
  const myId = pageCallId;

  if(!url.startsWith('http')) url = 'https://' + url;
  currentUrl = url;

  if(isBlocked(url)){
    contentFrame.src = 'about:blank';
    showError(url);
    return;
  }

  showLoading();
  const startTime = Date.now();

  contentFrame.onload = function(){
    if(myId !== pageCallId) return;
    clearChecks();
    const elapsed = Date.now() - startTime;
    try {
      const loc = contentFrame.contentWindow.location.href;
      if(loc === 'about:blank'){ addToDynamicBlocked(url); showError(url); return; }
    } catch(e){}
    if(elapsed < 200){
      checkTimer = setTimeout(function(){
        if(myId !== pageCallId) return;
        try {
          const loc = contentFrame.contentWindow.location.href;
          if(loc === 'about:blank'){ addToDynamicBlocked(url); showError(url); return; }
        } catch(e){}
        showFrame();
      }, 300);
    } else {
      showFrame();
    }
  };

  contentFrame.onerror = function(){
    if(myId !== pageCallId) return;
    clearChecks(); addToDynamicBlocked(url); showError(url);
  };

  loadTimer = setTimeout(function(){
    if(myId !== pageCallId) return;
    clearChecks(); addToDynamicBlocked(url); showError(url);
  }, 12000);

  contentFrame.src = url;
}

/* CSP violation */
document.addEventListener('securitypolicyviolation', function(e){
  if(e.blockedURI && currentUrl){
    const bh = getHostname(e.blockedURI);
    const ch = getHostname(currentUrl);
    if(bh === ch){ clearChecks(); addToDynamicBlocked(currentUrl); showError(currentUrl); }
  }
});

/* 새 창 열기 */
btnOpenNew.addEventListener('click', function(){
  if(currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
});

/* ─── 사이드바 토글 ─── */
const isMobile = () => window.innerWidth <= 768;

btnToggle.addEventListener('click', function(){
  if(isMobile()){
    sidebar.classList.remove('collapsed');
    sidebar.classList.toggle('expanded');
  } else {
    sidebar.classList.remove('expanded');
    sidebar.classList.toggle('collapsed');
  }
});

navList.addEventListener('click', function(){
  if(isMobile() && sidebar.classList.contains('expanded')){
    sidebar.classList.remove('expanded');
  }
});

/* ─── 가시성 필터 ─── */
function visible(bm){
  var f = bm.fields;
  if(!f) return false;
  var vis = f.Visibility || 'public';
  if(vis === 'public') return true;
  if(vis === 'admin' && APP.currentUserRole === 'admin') return true;
  return false;
}

/* ==========================================================
   호버 카드
   ========================================================== */
function showHoverCard(bm, targetEl){
  var f = bm.fields;
  var url = f.Url || '';
  hoverFav.src = faviconUrl(url);
  hoverFav.onerror = function(){ this.style.display='none'; };
  hoverFav.style.display = 'inline-block';
  hoverName.textContent = f.Title || '';
  hoverUrl.textContent = getHostname(url);
  hoverDesc.textContent = f.Description || '';
  if(isBlocked(url)){
    hoverTag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 새 창으로 열림';
  } else {
    hoverTag.textContent = '';
  }
  hoverCard.classList.add('show');
  positionHoverCard(targetEl);
}

function hideHoverCard(){ hoverCard.classList.remove('show'); }

function positionHoverCard(el){
  const r = el.getBoundingClientRect();
  const cardW = hoverCard.offsetWidth;
  const cardH = hoverCard.offsetHeight;
  let left = r.right + 10;
  let top = r.top + r.height / 2 - cardH / 2;
  if(left + cardW > window.innerWidth - 10) left = r.left - cardW - 10;
  if(top < 5) top = 5;
  if(top + cardH > window.innerHeight - 5) top = window.innerHeight - cardH - 5;
  hoverCard.style.left = left + 'px';
  hoverCard.style.top = top + 'px';
}

/* ==========================================================
   북마크 로드 (SharePoint)
   ========================================================== */
async function loadBookmarks(){
  try {
    var url = CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
              '/lists/' + CONFIG.bookmarksListId +
              '/items?$expand=fields&$top=999&$orderby=fields/SortOrder asc';
    var result = await graphGet(url);
    APP.bookmarks = result.value || [];
    renderNav();
  } catch(e) {
    console.error('[APP] 북마크 로드 실패:', e.message);
    toast('북마크 로드 실패: ' + e.message);
  }
}

/* ==========================================================
   사이드바 렌더링
   ========================================================== */
function renderNav(){
  navList.innerHTML = '';
  var pubItems  = APP.bookmarks.filter(b => visible(b) && (b.fields.Visibility || 'public') === 'public');
  var admItems  = APP.bookmarks.filter(b => visible(b) && b.fields.Visibility === 'admin');

  function makeSection(label, items, cls){
    if(items.length === 0) return;
    const sec = document.createElement('div');
    sec.className = 'nav-section ' + cls;
    const lbl = document.createElement('div');
    lbl.className = 'nav-section-label';
    lbl.textContent = label;
    sec.appendChild(lbl);

    items.forEach(bm => {
      var f = bm.fields;
      var bmUrl = f.Url || '';
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.id = bm.id;

      const icon = document.createElement('img');
      icon.className = 'nav-icon';
      icon.src = faviconUrl(bmUrl);
      icon.alt = '';
      icon.onerror = function(){ handleImgError(this, bmUrl, f.Title); };

      const name = document.createElement('span');
      name.className = 'nav-name';
      name.textContent = f.Title || '';

      item.appendChild(icon);
      item.appendChild(name);

      if(f.Visibility === 'admin'){
        const badge = document.createElement('span');
        badge.className = 'adm-badge';
        badge.textContent = 'ADM';
        item.appendChild(badge);
      }
      if(isBlocked(bmUrl)){
        const tag = document.createElement('span');
        tag.className = 'blocked-tag';
        tag.textContent = '새 창';
        item.appendChild(tag);
      }

      item.addEventListener('click', function(){
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        if(isBlocked(bmUrl)){
          window.open(bmUrl, '_blank', 'noopener,noreferrer');
        } else {
          openPage(bmUrl);
        }
      });
      item.addEventListener('mouseenter', function(){
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function(){ showHoverCard(bm, item); }, 400);
      });
      item.addEventListener('mouseleave', function(){
        clearTimeout(hoverTimer);
        hideHoverCard();
      });

      sec.appendChild(item);
    });
    navList.appendChild(sec);
  }

  makeSection('공개', pubItems, 'sec-public');
  makeSection('관리자', admItems, 'sec-admin');
}

/* ==========================================================
   관리 모달 — 즐겨찾기 목록
   ========================================================== */
function renderBmList(){
  bmSections.innerHTML = '';

  if(APP.currentUserRole === 'admin'){
    renderBmSection('공개', 'public');
    renderBmSection('관리자 전용', 'admin');
  } else {
    renderBmSection('공개', 'public');
  }
}

function renderBmSection(label, vis){
  var items = APP.bookmarks.filter(b => (b.fields.Visibility || 'public') === vis);

  const block = document.createElement('div');
  block.className = 'bm-block';

  const header = document.createElement('div');
  header.className = 'bm-block-header bm-block-' + vis;
  header.innerHTML = '<span class="bm-block-dot"></span> ' + label;
  block.appendChild(header);

  const list = document.createElement('div');
  list.className = 'bm-block-list';

  if(items.length === 0){
    const empty = document.createElement('div');
    empty.className = 'bm-empty';
    empty.textContent = '등록된 항목이 없습니다.';
    list.appendChild(empty);
  }

  items.forEach(bm => {
    var f = bm.fields;
    var bmUrl = f.Url || '';
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.dataset.id = bm.id;

    const favicon = document.createElement('img');
    favicon.className = 'bm-favicon';
    favicon.src = faviconUrl(bmUrl, 32);
    favicon.alt = '';
    favicon.onerror = function(){ handleImgError(this, bmUrl, f.Title); };

    const infoWrap = document.createElement('div');
    infoWrap.className = 'bm-info-wrap';

    const info = document.createElement('span');
    info.className = 'bm-info';
    info.textContent = f.Title || '';

    const sub = document.createElement('span');
    sub.className = 'bm-sub';
    sub.textContent = getHostname(bmUrl);

    infoWrap.appendChild(info);
    infoWrap.appendChild(sub);

    row.appendChild(favicon);
    row.appendChild(infoWrap);

    if(isBlocked(bmUrl)){
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      row.appendChild(tag);
    }

    // 관리자만 편집/삭제
    if(APP.currentUserRole === 'admin'){
      const edit = document.createElement('button');
      edit.className = 'bm-btn';
      edit.title = '편집';
      edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      edit.addEventListener('click', function(e){ e.stopPropagation(); openEditModal(bm); });

      const del = document.createElement('button');
      del.className = 'bm-btn bm-del';
      del.title = '삭제';
      del.textContent = '\u00D7';
      del.addEventListener('click', function(e){
        e.stopPropagation();
        deleteBookmark(bm);
      });

      row.appendChild(edit);
      row.appendChild(del);
    }

    list.appendChild(row);
  });

  block.appendChild(list);
  bmSections.appendChild(block);
}

/* ─── 북마크 추가 ─── */
btnAddBm.addEventListener('click', async function(){
  const url = inputUrl.value.trim();
  const name = inputName.value.trim();
  const desc = inputDesc.value.trim();
  const category = inputCategory.value.trim();
  const vis = inputVis.value;
  const sortOrder = parseInt(inputSortOrder.value) || 0;

  if(!url || !name){ toast('URL과 이름을 입력하세요'); return; }

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;

  var fields = {
    Title: name,
    Url: fullUrl,
    Description: desc,
    Category: category || '기타',
    Visibility: vis,
    Owner: APP.currentUserEmail,
    SortOrder: sortOrder
  };

  try {
    await graphPost(
      CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
      '/lists/' + CONFIG.bookmarksListId + '/items',
      { fields: fields }
    );
    toast('추가 완료');
    inputUrl.value = '';
    inputName.value = '';
    inputDesc.value = '';
    inputCategory.value = '';
    inputSortOrder.value = '0';
    inputHint.textContent = '';
    previewFav.style.display = 'none';

    await loadBookmarks();
    renderBmList();
  } catch(e) {
    toast('추가 실패: ' + e.message);
  }
});

/* ─── 북마크 삭제 ─── */
async function deleteBookmark(bm){
  if(!confirm((bm.fields.Title || '') + ' 을(를) 삭제하시겠습니까?')) return;
  try {
    await graphDelete(
      CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
      '/lists/' + CONFIG.bookmarksListId + '/items/' + bm.id
    );
    toast('삭제 완료');
    await loadBookmarks();
    renderBmList();
  } catch(e) {
    toast('삭제 실패: ' + e.message);
  }
}

/* ==========================================================
   편집 모달
   ========================================================== */
function openEditModal(bm){
  editingItem = bm;
  var f = bm.fields;
  editUrl.value = f.Url || '';
  editName.value = f.Title || '';
  editDesc.value = f.Description || '';
  editCategory.value = f.Category || '';
  editVis.value = f.Visibility || 'public';
  editSortOrder.value = f.SortOrder || 0;

  var eUrl = f.Url || '';
  editFav.src = faviconUrl(eUrl);
  editFav.style.display = 'inline-block';
  editFav.onerror = function(){ this.style.display='none'; };

  if(APP.currentUserRole === 'admin'){
    editVisRow.style.display = 'flex';
  } else {
    editVisRow.style.display = 'none';
  }

  editOverlay.classList.add('show');
}

function closeEditModal(){
  editOverlay.classList.remove('show');
  editingItem = null;
}

async function saveEdit(){
  if(!editingItem) return;
  const url = editUrl.value.trim();
  const name = editName.value.trim();
  const desc = editDesc.value.trim();
  const category = editCategory.value.trim();
  const vis = editVis.value;
  const sortOrder = parseInt(editSortOrder.value) || 0;

  if(!url || !name){ toast('URL과 이름을 입력하세요'); return; }

  var fields = {
    Title: name,
    Url: url.startsWith('http') ? url : 'https://' + url,
    Description: desc,
    Category: category || '기타',
    Visibility: vis,
    SortOrder: sortOrder
  };

  try {
    await graphPatch(
      CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
      '/lists/' + CONFIG.bookmarksListId + '/items/' + editingItem.id + '/fields',
      fields
    );
    toast('수정 완료');
    closeEditModal();
    await loadBookmarks();
    renderBmList();
  } catch(e) {
    toast('수정 실패: ' + e.message);
  }
}

editUrl.addEventListener('input', function(){
  const url = editUrl.value.trim();
  if(url){
    const full = url.startsWith('http') ? url : 'https://'+url;
    editFav.src = faviconUrl(full);
    editFav.style.display = 'inline-block';
  } else {
    editFav.style.display = 'none';
  }
});

btnSaveEdit.addEventListener('click', saveEdit);
btnCloseEdit.addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', function(e){
  if(e.target === editOverlay) closeEditModal();
});

/* ─── URL 입력 ─── */
inputUrl.addEventListener('input', function(){
  const url = inputUrl.value.trim();
  if(!url){
    previewFav.style.display = 'none';
    inputHint.textContent = '';
    return;
  }
  const full = url.startsWith('http') ? url : 'https://'+url;
  previewFav.src = faviconUrl(full);
  previewFav.style.display = 'inline-block';
  previewFav.onerror = function(){ this.style.display='none'; };

  if(isBlocked(full)){
    inputHint.textContent = '\u26A0 이 사이트는 iframe 차단됨 (새 창에서 열림)';
    inputHint.style.color = '#f0883e';
  } else {
    inputHint.textContent = '';
    inputHint.style.color = '';
  }

  if(!inputName.value.trim()){
    const h = getHostname(full);
    if(h) inputName.value = h.replace(/^www\./,'');
  }
});

/* ==========================================================
   탭 전환
   ========================================================== */
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', function(){
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const t = tab.dataset.tab;
    panelBookmarks.style.display = (t === 'bookmarks') ? '' : 'none';
    panelUsers.style.display = (t === 'users') ? '' : 'none';
  });
});

/* ─── 관리 모달 열기/닫기 ─── */
btnManager.addEventListener('click', function(){
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
  panelBookmarks.style.display = '';
  panelUsers.style.display = 'none';

  // 관리자 탭 표시
  if(APP.currentUserRole === 'admin'){
    tabUsers.style.display = '';
    inputVis.style.display = '';
  } else {
    tabUsers.style.display = 'none';
    inputVis.style.display = 'none';
  }

  renderBmList();
  modalOverlay.classList.add('show');
});

btnCloseModal.addEventListener('click', function(){ modalOverlay.classList.remove('show'); });
modalOverlay.addEventListener('click', function(e){ if(e.target === modalOverlay) modalOverlay.classList.remove('show'); });

/* ==========================================================
   관리자 관리 (Entra ID 그룹)
   ========================================================== */
async function loadAdminMembers(){
  try {
    var data = await graphGet(
      CONFIG.graphUrl + '/groups/' + CONFIG.groupId +
      '/members?$select=id,displayName,mail,userPrincipalName'
    );
    APP.adminMembers = data.value || [];
    renderAdminList();
  } catch(e) {
    toast('관리자 목록 조회 실패: ' + e.message);
  }
}

function renderAdminList(){
  adminList.innerHTML = '';
  if(APP.adminMembers.length === 0){
    adminList.innerHTML = '<div class="bm-empty">관리자가 없습니다.</div>';
    return;
  }
  APP.adminMembers.forEach(function(m){
    var email = m.mail || m.userPrincipalName || '';
    var isSelf = (m.id === APP.currentUserId);
    var item = document.createElement('div');
    item.className = 'user-item';

    var initial = ((m.displayName || '?').charAt(0)).toUpperCase();
    item.innerHTML =
      '<div class="user-avatar role-admin">' + initial + '</div>' +
      '<div class="user-info">' +
        '<div class="user-info-id">' + escHtml(m.displayName || '') +
          (isSelf ? '<span class="me-badge">(본인)</span>' : '') +
        '</div>' +
        '<div class="user-info-role">' + escHtml(email) + '</div>' +
      '</div>' +
      '<div class="user-actions">' +
        (isSelf ? '' : '<button class="btn-user-del" data-uid="'+m.id+'" data-name="'+escHtml(m.displayName || '')+'">제거</button>') +
      '</div>';

    adminList.appendChild(item);
  });

  // 제거 이벤트
  adminList.querySelectorAll('.btn-user-del').forEach(function(btn){
    btn.addEventListener('click', function(){
      removeAdmin(btn.dataset.uid, btn.dataset.name);
    });
  });
}

async function removeAdmin(userId, displayName){
  if(!confirm(displayName + ' 님을 관리자에서 제거하시겠습니까?')) return;
  if(userId === APP.currentUserId){ toast('자기 자신은 제거할 수 없습니다.'); return; }

  // 이메일 정보 미리 확보
  var member = APP.adminMembers.find(function(m){ return m.id === userId; });
  var ownerEmail = member ? (member.mail || member.userPrincipalName || '') : '';

  try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/' + userId + '/$ref'); } catch(e){}
  try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/' + userId + '/$ref'); } catch(e){}

  toast(displayName + ' 관리자에서 제거 완료');

  // 북마크 정리
  try {
    await deleteBookmarksByOwner(ownerEmail, displayName);
  } catch(e){
    console.warn('[관리자 제거] 북마크 정리 오류:', e.message);
  }

  await loadAdminMembers();
}

async function deleteBookmarksByOwner(ownerEmail, displayName){
  if(!ownerEmail) return;
  ownerEmail = ownerEmail.toLowerCase();

  var matching = APP.bookmarks.filter(function(b){
    var owner = b.fields.Owner;
    if(!owner || typeof owner !== 'string') return false;
    return owner.toLowerCase() === ownerEmail;
  });

  if(matching.length === 0) return;
  if(!confirm(displayName + ' 님이 등록한 북마크 ' + matching.length + '개도 삭제하시겠습니까?')) return;

  for(var i = 0; i < matching.length; i++){
    await graphDelete(
      CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
      '/lists/' + CONFIG.bookmarksListId + '/items/' + matching[i].id
    );
  }
  toast(matching.length + '개 북마크 삭제 완료');
  await loadBookmarks();
}

/* ─── 관리자 검색/추가 ─── */
btnSearchUser.addEventListener('click', searchUser);
inputAdminSearch.addEventListener('keydown', function(e){ if(e.key === 'Enter') searchUser(); });

async function searchUser(){
  var query = inputAdminSearch.value.trim();
  if(!query){ toast('검색어를 입력하세요'); return; }

  try {
    var url = CONFIG.graphUrl + '/users?$filter=startswith(displayName,\'' +
              encodeURIComponent(query) + '\') or startswith(mail,\'' +
              encodeURIComponent(query) + '\') or startswith(userPrincipalName,\'' +
              encodeURIComponent(query) + '\')&$top=10&$select=id,displayName,mail,userPrincipalName';
    var result = await graphGet(url);
    renderSearchResults(result.value || []);
  } catch(e){
    try {
      var user = await graphGet(CONFIG.graphUrl + '/users/' + encodeURIComponent(query));
      renderSearchResults([user]);
    } catch(e2){
      toast('검색 실패: ' + e.message);
      renderSearchResults([]);
    }
  }
}

function renderSearchResults(users){
  if(users.length === 0){
    searchResults.innerHTML = '<div class="bm-empty">검색 결과가 없습니다.</div>';
    return;
  }
  var html = '';
  users.forEach(function(user){
    var email = user.mail || user.userPrincipalName || '';
    html += '<div class="search-item">' +
      '<span><strong>' + escHtml(user.displayName || '') + '</strong> (' + escHtml(email) + ')</span>' +
      '<button class="btn-add btn-sm" onclick="addAdminById(\'' + user.id + '\',\'' + escHtml(user.displayName || '').replace(/'/g,"\\'") + '\')">추가</button>' +
    '</div>';
  });
  searchResults.innerHTML = html;
}

window.addAdminById = async function(userId, displayName){
  try {
    var ref = { '@odata.id': CONFIG.graphUrl + '/directoryObjects/' + userId };
    try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/$ref', ref); } catch(e){}
    try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/$ref', ref); } catch(e){}

    toast(displayName + ' 관리자로 추가 완료!');
    searchResults.innerHTML = '';
    inputAdminSearch.value = '';
    await loadAdminMembers();
  } catch(e){
    toast('추가 실패: ' + e.message);
  }
};

btnRefreshAdmins.addEventListener('click', loadAdminMembers);

/* ─── 로그아웃 ─── */
btnLogout.addEventListener('click', function(){ logout(); });

/* ─── ESC 키 ─── */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(editOverlay.classList.contains('show')) closeEditModal();
    else if(modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
  }
});

/* ==========================================================
   앱 초기화 (auth.js에서 호출)
   ========================================================== */
window.initApp = async function(){
  try { dynamicBlocked = JSON.parse(localStorage.getItem('portal_blocked')) || []; } catch(e){ dynamicBlocked = []; }
  await loadBookmarks();
  showWelcome();
};

})();
