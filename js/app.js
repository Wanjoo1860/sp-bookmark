// ============================================================
// 즐겨찾기 포털 — SharePoint + Graph API 버전
// GitHub 에러 화면 방식 적용 (openPage 내부에서 차단 판단)
// ============================================================
;(function(){
'use strict';

/* ─── 설정 (config.js에서 가져옴) ─── */
var CONFIG = window.PORTAL_CONFIG || {};

var KNOWN_BLOCKED = CONFIG.KNOWN_BLOCKED || [
  'google.com','google.co.kr','youtube.com','github.com','naver.com','daum.net','kakao.com',
  'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
  'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
  'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
  'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
  'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
  'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
  'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
];

/* ─── 전역 상태 ─── */
window.APP = window.APP || {};
var APP = window.APP;
APP.bookmarks = APP.bookmarks || [];
APP.dynamicBlocked = APP.dynamicBlocked || [];
APP.currentUrl = '';
APP.currentUserEmail = '';
APP.pageCallId = 0;

var checkTimer = null;
var loadTimer  = null;
var hoverTimer = null;
var editingId  = null;

/* ─── DOM 참조 ─── */
var sidebar       = document.getElementById('sidebar');
var btnToggle     = document.getElementById('btnToggle');
var btnManager    = document.getElementById('btnManager');
var btnLogout     = document.getElementById('btnLogout');
var navList       = document.getElementById('navList');
var contentFrame  = document.getElementById('contentFrame');
var welcomeScreen = document.getElementById('welcomeScreen');
var errorScreen   = document.getElementById('errorScreen');
var loadingScreen = document.getElementById('loadingScreen');
var errorDomain   = document.getElementById('errorDomain');
var btnOpenNew    = document.getElementById('btnOpenNew');
var modalOverlay  = document.getElementById('modalOverlay');
var btnCloseModal = document.getElementById('btnCloseModal');
var inputUrl      = document.getElementById('inputUrl');
var inputName     = document.getElementById('inputName');
var inputDesc     = document.getElementById('inputDesc');
var inputVis      = document.getElementById('inputVis');
var inputHint     = document.getElementById('inputHint');
var previewFav    = document.getElementById('previewFav');
var btnAddBm      = document.getElementById('btnAddBm');
var bmSections    = document.getElementById('bmSections');
var footerUser    = document.getElementById('footerUser');
var visRow        = document.getElementById('visRow');
var formTitle     = document.getElementById('formTitle');

var hoverCard = document.getElementById('hoverCard');
var hoverFav  = document.getElementById('hoverFav');
var hoverName = document.getElementById('hoverName');
var hoverUrl  = document.getElementById('hoverUrl');
var hoverDesc = document.getElementById('hoverDesc');
var hoverTag  = document.getElementById('hoverTag');

var editOverlay  = document.getElementById('editOverlay');
var btnCloseEdit = document.getElementById('btnCloseEdit');
var editUrl      = document.getElementById('editUrl');
var editName     = document.getElementById('editName');
var editDesc     = document.getElementById('editDesc');
var editVis      = document.getElementById('editVis');
var editFav      = document.getElementById('editFav');
var btnSaveEdit  = document.getElementById('btnSaveEdit');
var editVisRow   = document.getElementById('editVisRow');

var panelBookmarks = document.getElementById('panelBookmarks');
var panelUsers     = document.getElementById('panelUsers');
var tabUsers       = document.getElementById('tabUsers');

var toastEl = document.getElementById('toastMsg');

/* ─── 유틸 ─── */
function getHostname(url){
  try{ return new URL(url.startsWith('http') ? url : 'https://'+url).hostname.toLowerCase(); }
  catch(e){ return ''; }
}

function isBlocked(url){
  var h = getHostname(url);
  if(!h) return false;
  for(var i=0; i<KNOWN_BLOCKED.length; i++){
    var b = KNOWN_BLOCKED[i];
    if(h === b || h.endsWith('.'+b)) return true;
  }
  for(var j=0; j<APP.dynamicBlocked.length; j++){
    var d = APP.dynamicBlocked[j];
    if(h === d || h.endsWith('.'+d)) return true;
  }
  return false;
}

function addToDynamicBlocked(url){
  var h = getHostname(url);
  if(h && APP.dynamicBlocked.indexOf(h) === -1){
    APP.dynamicBlocked.push(h);
  }
}

function faviconUrl(url, sz){
  var h = getHostname(url);
  return h ? 'https://www.google.com/s2/favicons?domain='+h+'&sz='+(sz||64) : '';
}

function fallbackIcon(name){
  var ch = (name || '?').charAt(0).toUpperCase();
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="12" fill="#30363d"/>' +
    '<text x="32" y="40" font-size="28" font-family="sans-serif" fill="#e6edf3" text-anchor="middle">' + ch + '</text></svg>'
  );
}

function handleImgError(img, url, name){
  img.onerror = null;
  img.src = fallbackIcon(name || getHostname(url));
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(function(){ toastEl.classList.remove('show'); }, 2500);
}

/* ─── 화면 전환 ─── */
function hideAll(){
  welcomeScreen.style.display = 'none';
  errorScreen.style.display   = 'none';
  loadingScreen.style.display = 'none';
  contentFrame.style.display  = 'none';
}

function showWelcome(){
  hideAll();
  welcomeScreen.style.display = 'flex';
}

function showLoading(){
  hideAll();
  loadingScreen.style.display = 'flex';
}

function showFrame(){
  hideAll();
  contentFrame.style.display = 'block';
}

function showError(url){
  hideAll();
  errorScreen.style.display = 'flex';
  errorDomain.textContent = getHostname(url) || url;
  btnOpenNew.onclick = function(){
    window.open(url, '_blank', 'noopener,noreferrer');
  };
}

/* ─── iframe 제어 ─── */
function clearChecks(){
  if(checkTimer){ clearTimeout(checkTimer); checkTimer = null; }
  if(loadTimer){ clearTimeout(loadTimer); loadTimer = null; }
  contentFrame.onload = null;
  contentFrame.onerror = null;
}

function openPage(url){
  clearChecks();
  APP.pageCallId++;
  var myId = APP.pageCallId;

  if(!url){ showWelcome(); return; }
  if(!url.startsWith('http')) url = 'https://' + url;
  APP.currentUrl = url;

  // ─── 차단된 URL → 에러 화면 표시 ───
  if(isBlocked(url)){
    contentFrame.src = 'about:blank';
    showError(url);
    return;
  }

  // ─── 비차단 URL → iframe 로드 시도 ───
  showLoading();
  var start = Date.now();
  var loaded = false;

  contentFrame.onload = function(){
    if(myId !== APP.pageCallId) return;
    clearChecks();
    loaded = true;
    var elapsed = Date.now() - start;

    // 빠른 로드 (< 200ms) → X-Frame-Options 차단 의심
    if(elapsed < 200){
      checkTimer = setTimeout(function(){
        if(myId !== APP.pageCallId) return;
        try {
          var loc = contentFrame.contentWindow.location.href;
          if(loc === 'about:blank' || !loc){
            addToDynamicBlocked(url);
            showError(url);
          } else {
            showFrame();
          }
        } catch(e){
          // cross-origin → 정상 로드로 간주
          showFrame();
        }
      }, 300);
      return;
    }

    // 일반 로드 완료
    try {
      var loc = contentFrame.contentWindow.location.href;
      if(loc === 'about:blank'){
        addToDynamicBlocked(url);
        showError(url);
        return;
      }
    } catch(e){ /* cross-origin: 정상 */ }
    showFrame();
  };

  contentFrame.onerror = function(){
    if(myId !== APP.pageCallId) return;
    clearChecks();
    addToDynamicBlocked(url);
    showError(url);
  };

  // 타임아웃 12초
  loadTimer = setTimeout(function(){
    if(myId !== APP.pageCallId) return;
    clearChecks();
    if(!loaded){
      addToDynamicBlocked(url);
      showError(url);
    }
  }, 12000);

  contentFrame.src = url;
}

// CSP 위반 감지
document.addEventListener('securitypolicyviolation', function(e){
  var blocked = getHostname(e.blockedURI || '');
  var current = getHostname(APP.currentUrl || '');
  if(blocked && current && blocked === current){
    addToDynamicBlocked(APP.currentUrl);
    showError(APP.currentUrl);
  }
});

/* ─── 사이드바 토글 ─── */
btnToggle.addEventListener('click', function(){
  sidebar.classList.toggle('collapsed');
});

/* ─── 호버 카드 ─── */
function showHoverCard(el, bm){
  if(hoverTimer){ clearTimeout(hoverTimer); hoverTimer = null; }
  var f = bm.fields;
  var url = f.URL || '';
  var name = f.Title || '';
  hoverFav.src = faviconUrl(url, 28);
  hoverFav.onerror = function(){ this.onerror=null; this.src=fallbackIcon(name); };
  hoverName.textContent = name;
  hoverUrl.textContent = getHostname(url);
  hoverDesc.textContent = f.Description || '';
  hoverTag.textContent = isBlocked(url) ? '⚠ iframe 차단됨' : '';

  var rect = el.getBoundingClientRect();
  hoverCard.style.top = rect.top + 'px';
  hoverCard.style.left = (rect.right + 12) + 'px';
  hoverCard.classList.add('show');
}

function hideHoverCard(){
  hoverCard.classList.remove('show');
}

/* ─── 사이드바 렌더링 ─── */
function renderNav(){
  navList.innerHTML = '';
  var groups = { public: [], admin: [], private: [] };

  APP.bookmarks.forEach(function(bm){
    var f = bm.fields;
    var vis = (f.Visibility || 'public').toLowerCase();
    if(vis === 'admin') groups.admin.push(bm);
    else if(vis === 'private') groups.private.push(bm);
    else groups.public.push(bm);
  });

  var sections = [
    { key:'public', label:'공개', items: groups.public },
    { key:'admin', label:'관리자', items: groups.admin },
    { key:'private', label:'개인', items: groups.private }
  ];

  sections.forEach(function(sec){
    if(sec.items.length === 0) return;
    var div = document.createElement('div');
    div.className = 'nav-section sec-' + sec.key;

    var label = document.createElement('div');
    label.className = 'nav-section-label';
    label.textContent = sec.label;
    div.appendChild(label);

    sec.items.sort(function(a,b){ return (a.fields.SortOrder||0) - (b.fields.SortOrder||0); });

    sec.items.forEach(function(bm){
      var f = bm.fields;
      var url = f.URL || '';
      var name = f.Title || '(이름 없음)';

      var item = document.createElement('div');
      item.className = 'nav-item';
      item.setAttribute('data-id', bm.id);

      var icon = document.createElement('img');
      icon.className = 'nav-icon';
      icon.src = faviconUrl(url, 28);
      icon.alt = '';
      icon.onerror = function(){ handleImgError(this, url, name); };
      item.appendChild(icon);

      var span = document.createElement('span');
      span.className = 'nav-name';
      span.textContent = name;
      item.appendChild(span);

      // 차단 태그
      if(isBlocked(url)){
        var tag = document.createElement('span');
        tag.className = 'blocked-tag';
        tag.textContent = '새창';
        item.appendChild(tag);
      }

      // 관리자 배지
      if(sec.key === 'admin'){
        var badge = document.createElement('span');
        badge.className = 'adm-badge';
        badge.textContent = 'ADM';
        item.appendChild(badge);
      }

      // ★ 클릭 — 항상 openPage 호출 (GitHub 방식)
      item.addEventListener('click', function(){
        // active 처리
        var prev = navList.querySelector('.nav-item.active');
        if(prev) prev.classList.remove('active');
        item.classList.add('active');
        // openPage 호출 (내부에서 차단 여부 판단)
        openPage(url);
      });

      // 호버 카드
      item.addEventListener('mouseenter', function(){
        hoverTimer = setTimeout(function(){ showHoverCard(item, bm); }, 400);
      });
      item.addEventListener('mouseleave', function(){
        if(hoverTimer){ clearTimeout(hoverTimer); hoverTimer = null; }
        hideHoverCard();
      });

      div.appendChild(item);
    });

    navList.appendChild(div);
  });
}

/* ─── 데이터 로드 (SharePoint Graph API) ─── */
function loadBookmarks(){
  if(typeof graphGet !== 'function'){
    console.error('[app.js] graphGet 함수를 찾을 수 없습니다. graph.js가 로드되었는지 확인하세요.');
    return;
  }
  graphGet().then(function(items){
    APP.bookmarks = items || [];
    renderNav();
    // 현재 열린 페이지가 없을 때만 환영 화면 표시
    if(!APP.currentUrl){
      showWelcome();
    }
  }).catch(function(err){
    console.error('[loadBookmarks] 실패:', err);
    toast('북마크 로드 실패');
  });
}

/* ─── 북마크 추가 ─── */
function addBookmark(){
  var url  = (inputUrl.value || '').trim();
  var name = (inputName.value || '').trim();
  var desc = (inputDesc.value || '').trim();
  var vis  = inputVis ? inputVis.value : 'public';

  if(!url){ toast('URL을 입력하세요'); return; }
  if(!name) name = getHostname(url) || url;

  if(!url.startsWith('http')) url = 'https://' + url;

  var maxOrder = 0;
  APP.bookmarks.forEach(function(bm){
    var o = Number(bm.fields.SortOrder) || 0;
    if(o > maxOrder) maxOrder = o;
  });

  var fields = { Title: name, URL: url };
  if(desc) fields.Description = desc;
  if(vis) fields.Visibility = vis;
  if(APP.currentUserEmail) fields.Owner = APP.currentUserEmail;
  fields.SortOrder = maxOrder + 1;

  console.log('[addBookmark] 전송 fields:', JSON.stringify(fields));

  graphPost(fields).then(function(result){
    toast('추가 완료: ' + name);
    inputUrl.value = ''; inputName.value = ''; inputDesc.value = '';
    if(previewFav) previewFav.style.display = 'none';
    if(inputHint) inputHint.textContent = '';
    loadBookmarks();
  }).catch(function(err){
    console.error('[addBookmark] 실패:', err);
    // 최소 필드로 재시도
    console.log('[addBookmark] 최소 필드로 재시도...');
    graphPost({ Title: name, URL: url }).then(function(){
      toast('추가 완료 (최소): ' + name);
      inputUrl.value = ''; inputName.value = ''; inputDesc.value = '';
      loadBookmarks();
    }).catch(function(err2){
      toast('추가 실패: ' + (err2.message || err2));
      console.error('[addBookmark] 최소 필드 재시도도 실패:', err2);
    });
  });
}

/* ─── 북마크 삭제 ─── */
function deleteBookmark(id, name){
  if(!confirm('"' + name + '" 을(를) 삭제하시겠습니까?')) return;
  graphDelete(id).then(function(){
    toast('삭제 완료: ' + name);
    loadBookmarks();
  }).catch(function(err){
    toast('삭제 실패');
    console.error('[deleteBookmark]', err);
  });
}

/* ─── 편집 모달 ─── */
function openEditModal(bm){
  editingId = bm.id;
  var f = bm.fields;
  editUrl.value  = f.URL || '';
  editName.value = f.Title || '';
  editDesc.value = f.Description || '';
  if(editVis) editVis.value = f.Visibility || 'public';
  if(editFav){
    var fav = faviconUrl(f.URL || '', 24);
    if(fav){ editFav.src = fav; editFav.style.display = 'inline'; }
    else { editFav.style.display = 'none'; }
  }
  editOverlay.classList.add('show');
}

function closeEditModal(){
  editOverlay.classList.remove('show');
  editingId = null;
}

function saveEdit(){
  if(!editingId) return;
  var url  = (editUrl.value || '').trim();
  var name = (editName.value || '').trim();
  var desc = (editDesc.value || '').trim();
  var vis  = editVis ? editVis.value : 'public';

  if(!url){ toast('URL을 입력하세요'); return; }
  if(!name) name = getHostname(url) || url;
  if(!url.startsWith('http')) url = 'https://' + url;

  var fields = { Title: name, URL: url, Description: desc };
  if(vis) fields.Visibility = vis;

  graphPatch(editingId, fields).then(function(){
    toast('수정 완료: ' + name);
    closeEditModal();
    loadBookmarks();
  }).catch(function(err){
    toast('수정 실패');
    console.error('[saveEdit]', err);
  });
}

/* ─── 관리 모달 북마크 목록 ─── */
function renderBmSections(){
  if(!bmSections) return;
  bmSections.innerHTML = '';

  var groups = { public: [], admin: [], private: [] };
  APP.bookmarks.forEach(function(bm){
    var vis = (bm.fields.Visibility || 'public').toLowerCase();
    if(vis === 'admin') groups.admin.push(bm);
    else if(vis === 'private') groups.private.push(bm);
    else groups.public.push(bm);
  });

  var secs = [
    { key:'public', label:'공개', items: groups.public },
    { key:'admin', label:'관리자 전용', items: groups.admin },
    { key:'private', label:'개인', items: groups.private }
  ];

  secs.forEach(function(sec){
    var block = document.createElement('div');
    block.className = 'bm-block';

    var header = document.createElement('div');
    header.className = 'bm-block-header bm-block-' + sec.key;
    header.innerHTML = '<span class="bm-block-dot"></span> ' + sec.label + ' (' + sec.items.length + ')';
    block.appendChild(header);

    var list = document.createElement('div');
    list.className = 'bm-block-list';

    if(sec.items.length === 0){
      list.innerHTML = '<div class="bm-empty">항목 없음</div>';
    } else {
      sec.items.sort(function(a,b){ return (a.fields.SortOrder||0) - (b.fields.SortOrder||0); });
      sec.items.forEach(function(bm){
        var f = bm.fields;
        var url = f.URL || '';
        var name = f.Title || '';

        var row = document.createElement('div');
        row.className = 'bm-row';

        row.innerHTML =
          '<img class="bm-favicon" src="' + (faviconUrl(url,22)||fallbackIcon(name)) + '" alt="">' +
          '<div class="bm-info-wrap"><span class="bm-info">' + name + '</span>' +
          '<span class="bm-sub">' + (getHostname(url)||url) + '</span></div>';

        // 편집 버튼
        var btnEdit = document.createElement('button');
        btnEdit.className = 'bm-btn';
        btnEdit.title = '편집';
        btnEdit.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
        btnEdit.addEventListener('click', function(){ openEditModal(bm); });
        row.appendChild(btnEdit);

        // 삭제 버튼
        var btnDel = document.createElement('button');
        btnDel.className = 'bm-btn bm-del';
        btnDel.title = '삭제';
        btnDel.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
        btnDel.addEventListener('click', function(){ deleteBookmark(bm.id, name); });
        row.appendChild(btnDel);

        list.appendChild(row);
      });
    }

    block.appendChild(list);
    bmSections.appendChild(block);
  });
}

/* ─── 관리 모달 열기/닫기 ─── */
btnManager.addEventListener('click', function(){
  renderBmSections();
  modalOverlay.classList.add('show');
});

btnCloseModal.addEventListener('click', function(){
  modalOverlay.classList.remove('show');
});

modalOverlay.addEventListener('click', function(e){
  if(e.target === modalOverlay) modalOverlay.classList.remove('show');
});

/* ─── 모달 탭 전환 ─── */
document.querySelectorAll('.modal-tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    document.querySelectorAll('.modal-tab').forEach(function(t){ t.classList.remove('active'); });
    tab.classList.add('active');
    var target = tab.getAttribute('data-tab');
    if(target === 'bookmarks'){
      panelBookmarks.style.display = 'block';
      if(panelUsers) panelUsers.style.display = 'none';
    } else {
      panelBookmarks.style.display = 'none';
      if(panelUsers) panelUsers.style.display = 'block';
    }
  });
});

/* ─── 추가 버튼 ─── */
btnAddBm.addEventListener('click', addBookmark);

/* ─── URL 입력 시 파비콘 미리보기 ─── */
if(inputUrl){
  inputUrl.addEventListener('input', function(){
    var val = inputUrl.value.trim();
    var h = getHostname(val);
    if(h){
      var fav = faviconUrl(val, 24);
      previewFav.src = fav;
      previewFav.style.display = 'inline';
      previewFav.onerror = function(){ previewFav.style.display = 'none'; };
      if(inputHint) inputHint.textContent = isBlocked(val) ? '⚠ iframe 차단 — 새 창에서 열립니다' : '';
    } else {
      previewFav.style.display = 'none';
      if(inputHint) inputHint.textContent = '';
    }
  });
}

/* ─── 편집 모달 이벤트 ─── */
btnCloseEdit.addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', function(e){
  if(e.target === editOverlay) closeEditModal();
});
btnSaveEdit.addEventListener('click', saveEdit);

/* ─── 로그아웃 ─── */
btnLogout.addEventListener('click', function(){
  if(typeof msalLogout === 'function') msalLogout();
  else window.location.reload();
});

/* ─── ESC 키 ─── */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(editOverlay.classList.contains('show')) closeEditModal();
    else if(modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
  }
});

/* ─── 초기화 ─── */
function initApp(){
  // 사용자 정보 표시
  if(APP.currentUserEmail && footerUser){
    footerUser.textContent = APP.currentUserEmail;
  }
  // 북마크 로드
  loadBookmarks();
}

// auth.js에서 로그인 완료 후 initApp()을 호출하도록 설정
// 또는 MSAL 인증 성공 콜백에서 호출
window.initApp = initApp;

// auth.js가 없는 경우 바로 실행 (개발/테스트용)
if(typeof msalLogin === 'undefined'){
  console.log('[app.js] auth.js 없음 — 바로 initApp 호출');
  initApp();
}

})();
