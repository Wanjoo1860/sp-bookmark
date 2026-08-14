;(function(){
'use strict';

/* ─── 상수 ─── */
const ST_BM = 'portal_bm_v7';
const ST_US = 'portal_us_v7';
const ST_SS = 'portal_ss_v7';
const ST_BL = 'portal_blocked_v7';

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

const DEFAULT_USERS = [
  {id:'admin', pw:'admin123', role:'admin'},
  {id:'user1', pw:'user123', role:'user'}
];

/* ─── 상태 ─── */
let currentUser    = null;
let currentUrl     = '';
let bookmarks      = [];
let dynamicBlocked = [];
let checkTimer     = null;
let loadTimer      = null;
let pageCallId     = 0;
let hoverTimer     = null;
let editingId      = null;

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
const loginWrap     = $('#loginWrap');
const loginForm     = $('#loginForm');
const loginId       = $('#loginId');
const loginPw       = $('#loginPw');
const loginError    = $('#loginError');
const modalOverlay  = $('#modalOverlay');
const btnCloseModal = $('#btnCloseModal');
const inputUrl      = $('#inputUrl');
const inputName     = $('#inputName');
const inputDesc     = $('#inputDesc');
const inputVis      = $('#inputVis');
const inputHint     = $('#inputHint');
const previewFav    = $('#previewFav');
const btnAddBm      = $('#btnAddBm');
const bmSections    = $('#bmSections');
const footerUser    = $('#footerUser');
const visRow        = $('#visRow');
const formTitle     = $('#formTitle');

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
const editVis      = $('#editVis');
const editFav      = $('#editFav');
const btnSaveEdit  = $('#btnSaveEdit');
const editVisRow   = $('#editVisRow');

// 탭
const panelBookmarks = $('#panelBookmarks');
const panelUsers     = $('#panelUsers');
const tabUsers       = $('#tabUsers');

// 사용자 관리
const userInputId   = $('#userInputId');
const userInputPw   = $('#userInputPw');
const userInputRole = $('#userInputRole');
const btnAddUser    = $('#btnAddUser');
const userList      = $('#userList');
const userCount     = $('#userCount');
const userFormTitle = $('#userFormTitle');

// 토스트
const toastEl = $('#toastMsg');

/* ─── 유틸 ─── */
function loadJSON(key, def){
  try{ return JSON.parse(localStorage.getItem(key)) || def; }
  catch(e){ return def; }
}
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

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
    saveJSON(ST_BL, dynamicBlocked);
  }
}

function faviconUrl(url, sz){
  const h = getHostname(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=${sz||64}` : '';
}

function fallbackIcon(name){
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl(${hue},55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function handleImgError(img, url, name){
  const h = getHostname(url);
  if(!img.dataset.retry){
    img.dataset.retry = '1';
    img.src = `https://icons.duckduckgo.com/ip3/${h}.ico`;
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

/* ─── iframe 체크 정리 ─── */
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

/* ─── CSP violation ─── */
document.addEventListener('securitypolicyviolation', function(e){
  if(e.blockedURI && currentUrl){
    const bh = getHostname(e.blockedURI);
    const ch = getHostname(currentUrl);
    if(bh === ch){ clearChecks(); addToDynamicBlocked(currentUrl); showError(currentUrl); }
  }
});

/* ─── 새 창 열기 ─── */
btnOpenNew.addEventListener('click', function(){
  if(currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
});

/* ─── 사이드바 토글 ─── */
const isMobile = () => window.innerWidth <= 768;

btnToggle.addEventListener('click', function(){
  if(isMobile()){
    // 모바일: expanded 토글, collapsed는 항상 제거
    sidebar.classList.remove('collapsed');
    sidebar.classList.toggle('expanded');
  } else {
    // PC: collapsed 토글, expanded는 항상 제거
    sidebar.classList.remove('expanded');
    sidebar.classList.toggle('collapsed');
  }
});

navList.addEventListener('click', function(){
  if(isMobile() && sidebar.classList.contains('expanded')){
    sidebar.classList.remove('expanded');
  }
});


/* ─── 사이드바 가시성 ─── */
function visible(bm){
  if(!currentUser) return false;
  if(bm.vis === 'public') return true;
  if(bm.vis === 'admin' && currentUser.role === 'admin') return true;
  if(bm.vis === 'private' && bm.owner === currentUser.id) return true;
  return false;
}

/* ==========================================================
   호버 카드
   ========================================================== */
function showHoverCard(bm, targetEl){
  hoverFav.src = faviconUrl(bm.url);
  hoverFav.onerror = function(){ this.style.display='none'; };
  hoverFav.style.display = 'inline-block';
  hoverName.textContent = bm.name;
  hoverUrl.textContent = getHostname(bm.url);
  hoverDesc.textContent = bm.desc || '';
  if(isBlocked(bm.url)){
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
   사이드바 렌더링
   ========================================================== */
function renderNav(){
  navList.innerHTML = '';
  const pubItems  = bookmarks.filter(b => b.vis === 'public' && visible(b));
  const admItems  = bookmarks.filter(b => b.vis === 'admin' && visible(b));
  const privItems = bookmarks.filter(b => b.vis === 'private' && visible(b));

  function makeSection(label, items, cls){
    if(items.length === 0) return;
    const sec = document.createElement('div');
    sec.className = 'nav-section ' + cls;
    const lbl = document.createElement('div');
    lbl.className = 'nav-section-label';
    lbl.textContent = label;
    sec.appendChild(lbl);
    items.sort((a,b) => (a.ord||0) - (b.ord||0));
    items.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.id = bm.id;

      const icon = document.createElement('img');
      icon.className = 'nav-icon';
      icon.src = faviconUrl(bm.url);
      icon.alt = '';
      icon.onerror = function(){ handleImgError(this, bm.url, bm.name); };

      const name = document.createElement('span');
      name.className = 'nav-name';
      name.textContent = bm.name;

      item.appendChild(icon);
      item.appendChild(name);

      if(bm.vis === 'admin'){
        const badge = document.createElement('span');
        badge.className = 'adm-badge';
        badge.textContent = 'ADM';
        item.appendChild(badge);
      }
      if(isBlocked(bm.url)){
        const tag = document.createElement('span');
        tag.className = 'blocked-tag';
        tag.textContent = '새 창';
        item.appendChild(tag);
      }

      item.addEventListener('click', function(){
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        openPage(bm.url);
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
  makeSection('개인', privItems, 'sec-private');
}

/* ==========================================================
   편집 모달
   ========================================================== */
function openEditModal(bm){
  editingId = bm.id;
  editUrl.value = bm.url;
  editName.value = bm.name;
  editDesc.value = bm.desc || '';
  editVis.value = bm.vis;
  editFav.src = faviconUrl(bm.url);
  editFav.style.display = 'inline-block';
  editFav.onerror = function(){ this.style.display='none'; };

  if(currentUser.role === 'admin'){
    editVisRow.style.display = 'flex';
  } else {
    editVisRow.style.display = 'none';
  }

  editOverlay.classList.add('show');
}

function closeEditModal(){
  editOverlay.classList.remove('show');
  editingId = null;
}

function saveEdit(){
  if(!editingId) return;
  const bm = bookmarks.find(b => b.id === editingId);
  if(!bm) return;

  const url = editUrl.value.trim();
  const name = editName.value.trim();
  const desc = editDesc.value.trim();

  if(!url || !name){ toast('URL과 이름을 입력하세요'); return; }

  bm.url  = url.startsWith('http') ? url : 'https://' + url;
  bm.name = name;
  bm.desc = desc;

  if(currentUser.role === 'admin'){
    bm.vis = editVis.value;
  }

  saveJSON(ST_BM, bookmarks);
  renderBmList();
  renderNav();
  closeEditModal();
  toast('수정 완료');
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

/* ==========================================================
   관리 모달 — 즐겨찾기 섹션별 렌더링
   ========================================================== */
function renderBmList(){
  bmSections.innerHTML = '';

  if(currentUser.role === 'admin'){
    renderBmSection('공개', 'public', false);
    renderBmSection('관리자 전용', 'admin', false);
    renderBmSection('개인', 'private', true);
  } else {
    renderBmSection('내 북마크', 'private', true);
  }
}

function renderBmSection(label, vis, ownerOnly){
  let items;
  if(ownerOnly){
    items = bookmarks.filter(b => b.vis === vis && b.owner === currentUser.id);
  } else {
    items = bookmarks.filter(b => b.vis === vis);
  }
  items.sort((a,b) => (a.ord||0) - (b.ord||0));

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
    const globalIdx = bookmarks.indexOf(bm);
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.draggable = true;
    row.dataset.id = bm.id;
    row.dataset.vis = vis;

    const favicon = document.createElement('img');
    favicon.className = 'bm-favicon';
    favicon.src = faviconUrl(bm.url, 32);
    favicon.alt = '';
    favicon.onerror = function(){ handleImgError(this, bm.url, bm.name); };

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

    if(isBlocked(bm.url)){
      const tag = document.createElement('span');
      tag.className = 'blocked-tag';
      tag.textContent = '새 창';
      row.appendChild(tag);
    }

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
      if(!confirm(bm.name + ' 을(를) 삭제하시겠습니까?')) return;
      bookmarks.splice(globalIdx, 1);
      bookmarks.forEach((b, i) => b.ord = i);
      saveJSON(ST_BM, bookmarks);
      renderBmList();
      renderNav();
      toast('삭제 완료');
    });

    row.appendChild(edit);
    row.appendChild(del);

    // 드래그앤드롭
    row.addEventListener('dragstart', function(e){
      e.dataTransfer.setData('text/plain', bm.id);
      e.dataTransfer.setData('text/vis', vis);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', function(){ row.classList.remove('dragging'); });
    row.addEventListener('dragover', function(e){ e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', function(){ row.classList.remove('drag-over'); });
    row.addEventListener('drop', function(e){
      e.preventDefault();
      row.classList.remove('drag-over');
      const dragId = e.dataTransfer.getData('text/plain');
      const dragVis = e.dataTransfer.getData('text/vis');
      if(dragVis !== vis) return;
      if(dragId === bm.id) return;
      reorderInSection(dragId, bm.id, vis, ownerOnly);
    });

    list.appendChild(row);
  });

  block.appendChild(list);
  bmSections.appendChild(block);
}

function reorderInSection(dragId, targetId, vis, ownerOnly){
  let sectionItems;
  if(ownerOnly){
    sectionItems = bookmarks.filter(b => b.vis === vis && b.owner === currentUser.id).sort((a,b) => (a.ord||0) - (b.ord||0));
  } else {
    sectionItems = bookmarks.filter(b => b.vis === vis).sort((a,b) => (a.ord||0) - (b.ord||0));
  }

  const dragIdx = sectionItems.findIndex(b => b.id === dragId);
  const targetIdx = sectionItems.findIndex(b => b.id === targetId);
  if(dragIdx === -1 || targetIdx === -1) return;

  const [moved] = sectionItems.splice(dragIdx, 1);
  sectionItems.splice(targetIdx, 0, moved);
  sectionItems.forEach((b, i) => b.ord = i);

  saveJSON(ST_BM, bookmarks);
  renderBmList();
  renderNav();
}

/* ─── URL 입력 ─── */
function onUrlInput(){
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
}
inputUrl.addEventListener('input', onUrlInput);

/* ─── 북마크 추가 ─── */
btnAddBm.addEventListener('click', function(){
  const url = inputUrl.value.trim();
  const name = inputName.value.trim();
  const desc = inputDesc ? inputDesc.value.trim() : '';
  if(!url || !name){ toast('URL과 이름을 입력하세요'); return; }

  const full = url.startsWith('http') ? url : 'https://'+url;

  let vis;
  if(currentUser.role === 'admin'){
    vis = inputVis.value;
  } else {
    vis = 'private';
  }

  const bm = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name: name,
    url: full,
    desc: desc,
    vis: vis,
    owner: currentUser.id,
    ord: bookmarks.length
  };
  bookmarks.push(bm);
  saveJSON(ST_BM, bookmarks);

  inputUrl.value = '';
  inputName.value = '';
  if(inputDesc) inputDesc.value = '';
  inputHint.textContent = '';
  previewFav.style.display = 'none';

  renderBmList();
  renderNav();
  toast('추가 완료');
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
  // 탭 초기화 (즐겨찾기 탭 활성)
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
  panelBookmarks.style.display = '';
  panelUsers.style.display = 'none';

  // 사용자 관리 탭: 관리자만 표시
  if(currentUser.role === 'admin'){
    tabUsers.style.display = '';
  } else {
    tabUsers.style.display = 'none';
  }

  // 일반 사용자: 공개 범위 select만 숨김, 추가 버튼은 유지
  if(currentUser.role === 'admin'){
    inputVis.style.display = '';
  } else {
    inputVis.style.display = 'none';
  }

  renderBmList();
  renderUserList();
  modalOverlay.classList.add('show');
});

btnCloseModal.addEventListener('click', function(){
  modalOverlay.classList.remove('show');
});

modalOverlay.addEventListener('click', function(e){
  if(e.target === modalOverlay) modalOverlay.classList.remove('show');
});

/* ==========================================================
   사용자 관리 (관리자 전용)
   ========================================================== */
function getUsers(){
  let users = loadJSON(ST_US, null);
  if(!users){
    users = DEFAULT_USERS;
    saveJSON(ST_US, users);
  }
  return users;
}

function saveUsers(users){
  saveJSON(ST_US, users);
}

function renderUserList(){
  if(!userList) return;
  if(!currentUser || currentUser.role !== 'admin') return;

  const users = getUsers();
  userList.innerHTML = '';
  userCount.textContent = users.length + '명';

  users.forEach(u => {
    const item = document.createElement('div');
    item.className = 'user-item';

    const initial = (u.id || '?').charAt(0).toUpperCase();
    const isMe = (u.id === currentUser.id);
    const roleLabel = u.role === 'admin' ? '관리자' : '일반 사용자';

    item.innerHTML = `
      <div class="user-avatar role-${u.role}">${initial}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(u.id)}${isMe ? '<span class="me-badge">(나)</span>' : ''}</div>
        <div class="user-info-role">${roleLabel}</div>
      </div>
      <div class="user-actions">
        ${!isMe ? `<button class="btn-user-role" data-uid="${escHtml(u.id)}">${u.role === 'admin' ? '→ 일반' : '→ 관리자'}</button>` : ''}
        ${!isMe ? `<button class="btn-user-del" data-uid="${escHtml(u.id)}">삭제</button>` : ''}
      </div>
    `;

    userList.appendChild(item);
  });

  // 역할 변경 이벤트
  userList.querySelectorAll('.btn-user-role').forEach(btn => {
    btn.addEventListener('click', function(){
      const uid = btn.dataset.uid;
      const users = getUsers();
      const user = users.find(u => u.id === uid);
      if(!user) return;

      const newRole = user.role === 'admin' ? 'user' : 'admin';
      const label = newRole === 'admin' ? '관리자' : '일반 사용자';

      if(!confirm(`"${uid}"의 역할을 ${label}(으)로 변경하시겠습니까?`)) return;

      user.role = newRole;
      saveUsers(users);
      renderUserList();
      toast(`"${uid}" → ${label} 변경 완료`);
    });
  });

  // 삭제 이벤트
  userList.querySelectorAll('.btn-user-del').forEach(btn => {
    btn.addEventListener('click', function(){
      const uid = btn.dataset.uid;
      if(!confirm(`"${uid}" 사용자를 삭제하시겠습니까?\n해당 사용자의 개인 즐겨찾기도 함께 삭제됩니다.`)) return;

      let users = getUsers();
      users = users.filter(u => u.id !== uid);
      saveUsers(users);

      // 해당 사용자의 개인 북마크 삭제
      bookmarks = bookmarks.filter(b => !(b.owner === uid && b.vis === 'private'));
      bookmarks.forEach((b, i) => b.ord = i);
      saveJSON(ST_BM, bookmarks);

      renderUserList();
      renderNav();
      toast(`"${uid}" 삭제 완료`);
    });
  });
}

// 사용자 추가
btnAddUser.addEventListener('click', function(){
  const id = userInputId.value.trim();
  const pw = userInputPw.value.trim();
  const role = userInputRole.value;

  if(!id){ toast('아이디를 입력하세요'); userInputId.focus(); return; }
  if(!pw){ toast('비밀번호를 입력하세요'); userInputPw.focus(); return; }

  const users = getUsers();
  if(users.find(u => u.id === id)){
    toast('이미 존재하는 아이디입니다');
    userInputId.focus();
    return;
  }

  users.push({ id, pw, role });
  saveUsers(users);

  userInputId.value = '';
  userInputPw.value = '';
  userInputRole.value = 'user';

  renderUserList();
  const label = role === 'admin' ? '관리자' : '사용자';
  toast(`${label} "${id}" 추가 완료`);
});

function escHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ─── 인증 ─── */
function doLogin(id, pw){
  const users = getUsers();
  return users.find(u => u.id === id && u.pw === pw) || null;
}

function setSession(user){
  currentUser = user;
  saveJSON(ST_SS, {id: user.id, role: user.role});
  document.body.classList.toggle('is-admin', user.role === 'admin');
  if(footerUser) footerUser.textContent = user.id;
}

function clearSession(){
  currentUser = null;
  localStorage.removeItem(ST_SS);
  document.body.classList.remove('is-admin');
  if(footerUser) footerUser.textContent = '';
}

function checkSession(){
  const s = loadJSON(ST_SS, null);
  if(s){
    const users = getUsers();
    const u = users.find(u => u.id === s.id);
    if(u){ setSession(u); return true; }
  }
  return false;
}

loginForm.addEventListener('submit', function(e){
  e.preventDefault();
  const id = loginId.value.trim();
  const pw = loginPw.value.trim();
  const user = doLogin(id, pw);
  if(user){
    setSession(user);
    showApp();
  } else {
    if(loginError) loginError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
  }
});

btnLogout.addEventListener('click', function(){
  clearSession();
  showLoginScreen();
});

/* ─── 앱/로그인 전환 ─── */
function showLoginScreen(){
  loginWrap.style.display = 'flex';
  sidebar.style.display   = 'none';
  hideAll();
  contentFrame.src = 'about:blank';
}

function showApp(){
  loginWrap.style.display = 'none';
  sidebar.style.display   = 'flex';
  bookmarks = loadJSON(ST_BM, []);
  dynamicBlocked = loadJSON(ST_BL, []);
  renderNav();
  showWelcome();
}

/* ─── ESC 키 ─── */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(editOverlay.classList.contains('show')) closeEditModal();
    else if(modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
  }
});

/* ─── 초기화 ─── */
(function init(){
  if(checkSession()) showApp();
  else showLoginScreen();
})();

})();
