/**
 * ui.js — UI 렌더링/이벤트 바인딩 (앱 진입점)
 * 의존성: config.js, graph.js, auth.js, admin.js, crud.js
 */
;(function() {
  'use strict';

  /* ═══════════════════════════════════════
     상태
     ═══════════════════════════════════════ */
  var bookmarks = [];
  var dynamicBlocked = JSON.parse(localStorage.getItem('sp_blocked') || '[]');
  var currentUrl = '';
  var pageCallId = 0;
  var checkTimer = null;
  var loadTimer = null;
  var hoverTimer = null;
  var editingItem = null;

  /* ═══════════════════════════════════════
     DOM 참조
     ═══════════════════════════════════════ */
  var $ = function(s) { return document.querySelector(s); };

  var splashScreen  = $('#splashScreen');
  var loginScreen   = $('#loginScreen');
  var appWrap       = $('#appWrap');
  var btnLogin      = $('#btnLogin');
  var loginError    = $('#loginError');

  var sidebar       = $('#sidebar');
  var btnToggle     = $('#btnToggle');
  var navList       = $('#navList');
  var btnManager    = $('#btnManager');
  var btnLogout     = $('#btnLogout');
  var footerUserName = $('#footerUserName');
  var footerUserRole = $('#footerUserRole');
  var userAvatar    = $('#userAvatar');

  var welcomeScreen = $('#welcomeScreen');
  var loadingScreen = $('#loadingScreen');
  var errorScreen   = $('#errorScreen');
  var errorDomain   = $('#errorDomain');
  var btnOpenNew    = $('#btnOpenNew');
  var contentFrame  = $('#contentFrame');

  var modalOverlay  = $('#modalOverlay');
  var btnCloseModal = $('#btnCloseModal');
  var tabAdmin      = $('#tabAdmin');
  var panelBookmarks = $('#panelBookmarks');
  var panelAdmin    = $('#panelAdmin');

  var inputUrl      = $('#inputUrl');
  var inputName     = $('#inputName');
  var inputDesc     = $('#inputDesc');
  var inputVis      = $('#inputVis');
  var inputHint     = $('#inputHint');
  var previewFav    = $('#previewFav');
  var visRow        = $('#visRow');
  var btnAddBm      = $('#btnAddBm');
  var bmSections    = $('#bmSections');
  var bmLoading     = $('#bmLoading');
  var addLoading    = $('#addLoading');

  var editOverlay   = $('#editOverlay');
  var btnCloseEdit  = $('#btnCloseEdit');
  var editUrl       = $('#editUrl');
  var editName      = $('#editName');
  var editDesc      = $('#editDesc');
  var editVis       = $('#editVis');
  var editFav       = $('#editFav');
  var editVisRow    = $('#editVisRow');
  var btnSaveEdit   = $('#btnSaveEdit');
  var editLoading   = $('#editLoading');

  var adminEmail    = $('#adminEmail');
  var btnAddAdmin   = $('#btnAddAdmin');
  var adminList     = $('#adminList');
  var adminCount    = $('#adminCount');
  var adminLoading  = $('#adminLoading');
  var adminAddLoading = $('#adminAddLoading');

  var hoverCard     = $('#hoverCard');
  var hoverFav      = $('#hoverFav');
  var hoverName     = $('#hoverName');
  var hoverUrl      = $('#hoverUrl');
  var hoverDesc     = $('#hoverDesc');
  var hoverTag      = $('#hoverTag');

  var toastEl       = $('#toastMsg');

  /* ═══════════════════════════════════════
     유틸리티
     ═══════════════════════════════════════ */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function() { toastEl.classList.remove('show'); }, 2500);
  }

  function getHostname(url) {
    try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase(); }
    catch(e) { return ''; }
  }

  function isBlocked(url) {
    var h = getHostname(url);
    if (!h) return false;
    for (var i = 0; i < CONFIG.knownBlocked.length; i++) {
      var d = CONFIG.knownBlocked[i];
      if (h === d || h.endsWith('.' + d)) return true;
    }
    for (var j = 0; j < dynamicBlocked.length; j++) {
      var d2 = dynamicBlocked[j];
      if (h === d2 || h.endsWith('.' + d2)) return true;
    }
    return false;
  }

  function addToDynamicBlocked(url) {
    var h = getHostname(url);
    if (h && dynamicBlocked.indexOf(h) === -1) {
      dynamicBlocked.push(h);
      localStorage.setItem('sp_blocked', JSON.stringify(dynamicBlocked));
    }
  }

  function faviconUrl(url, sz) {
    var h = getHostname(url);
    return h ? 'https://www.google.com/s2/favicons?domain=' + h + '&sz=' + (sz || 64) : '';
  }

  function fallbackIcon(name) {
    var ch = (name || '?').charAt(0).toUpperCase();
    var hue = (ch.charCodeAt(0) * 47) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl(' + hue + ',55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">' + ch + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }

  function handleImgError(img, url, name) {
    var h = getHostname(url);
    if (!img.dataset.retry) {
      img.dataset.retry = '1';
      img.src = 'https://icons.duckduckgo.com/ip3/' + h + '.ico';
      return;
    }
    if (img.dataset.retry === '1') {
      img.dataset.retry = '2';
      img.src = fallbackIcon(name || h);
      return;
    }
    img.style.display = 'none';
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function isMobile() { return window.innerWidth <= 768; }

  /* ═══════════════════════════════════════
     화면 전환
     ═══════════════════════════════════════ */
  function hideAll() {
    welcomeScreen.style.display = 'none';
    errorScreen.style.display = 'none';
    loadingScreen.style.display = 'none';
    contentFrame.style.display = 'none';
  }
  function showWelcome() { hideAll(); welcomeScreen.style.display = 'flex'; }
  function showError(url) { hideAll(); errorDomain.textContent = getHostname(url) || url; errorScreen.style.display = 'flex'; }
  function showLoading() { hideAll(); loadingScreen.style.display = 'flex'; }
  function showFrame() { hideAll(); contentFrame.style.display = 'block'; }

  /* ═══════════════════════════════════════
     iframe 페이지 열기
     ═══════════════════════════════════════ */
  function clearChecks() {
    if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
    contentFrame.onload = null;
    contentFrame.onerror = null;
  }

  function openPage(url) {
    clearChecks();
    pageCallId++;
    var myId = pageCallId;

    if (!url.startsWith('http')) url = 'https://' + url;
    currentUrl = url;

    if (isBlocked(url)) {
      contentFrame.src = 'about:blank';
      showError(url);
      return;
    }

    showLoading();
    var startTime = Date.now();

    contentFrame.onload = function() {
      if (myId !== pageCallId) return;
      clearChecks();
      var elapsed = Date.now() - startTime;
      try {
        var loc = contentFrame.contentWindow.location.href;
        if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
      } catch(e) {}
      if (elapsed < 200) {
        checkTimer = setTimeout(function() {
          if (myId !== pageCallId) return;
          try {
            var loc2 = contentFrame.contentWindow.location.href;
            if (loc2 === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
          } catch(e) {}
          showFrame();
        }, 300);
      } else {
        showFrame();
      }
    };

    contentFrame.onerror = function() {
      if (myId !== pageCallId) return;
      clearChecks(); addToDynamicBlocked(url); showError(url);
    };

    loadTimer = setTimeout(function() {
      if (myId !== pageCallId) return;
      clearChecks(); addToDynamicBlocked(url); showError(url);
    }, 12000);

    contentFrame.src = url;
  }

  document.addEventListener('securitypolicyviolation', function(e) {
    if (e.blockedURI && currentUrl) {
      var bh = getHostname(e.blockedURI);
      var ch = getHostname(currentUrl);
      if (bh === ch) { clearChecks(); addToDynamicBlocked(currentUrl); showError(currentUrl); }
    }
  });

  btnOpenNew.addEventListener('click', function() {
    if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
  });

  /* ═══════════════════════════════════════
     사이드바
     ═══════════════════════════════════════ */
  btnToggle.addEventListener('click', function() {
    if (isMobile()) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.toggle('expanded');
    } else {
      sidebar.classList.remove('expanded');
      sidebar.classList.toggle('collapsed');
    }
  });

  navList.addEventListener('click', function() {
    if (isMobile() && sidebar.classList.contains('expanded')) {
      sidebar.classList.remove('expanded');
    }
  });

  /* ═══════════════════════════════════════
     사이드바 렌더링
     ═══════════════════════════════════════ */
  function visible(bm) {
    var profile = Auth.getProfile();
    if (!profile) return false;
    if (bm.vis === 'public') return true;
    if (bm.vis === 'admin' && Auth.isAdmin()) return true;
    if (bm.vis === 'private' && bm.owner === profile.email) return true;
    return false;
  }

  function renderNav() {
    navList.innerHTML = '';
    var pubItems = bookmarks.filter(function(b) { return b.vis === 'public' && visible(b); });
    var admItems = bookmarks.filter(function(b) { return b.vis === 'admin' && visible(b); });
    var privItems = bookmarks.filter(function(b) { return b.vis === 'private' && visible(b); });

    makeSection('공개', pubItems, 'sec-public');
    makeSection('관리자', admItems, 'sec-admin');
    makeSection('개인', privItems, 'sec-private');
  }

  function makeSection(label, items, cls) {
    if (items.length === 0) return;
    var sec = document.createElement('div');
    sec.className = 'nav-section ' + cls;
    var lbl = document.createElement('div');
    lbl.className = 'nav-section-label';
    lbl.textContent = label;
    sec.appendChild(lbl);

    items.forEach(function(bm) {
      var item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.id = bm.id;

      var icon = document.createElement('img');
      icon.className = 'nav-icon';
      icon.src = faviconUrl(bm.url);
      icon.alt = '';
      icon.onerror = function() { handleImgError(this, bm.url, bm.name); };

      var name = document.createElement('span');
      name.className = 'nav-name';
      name.textContent = bm.name;

      item.appendChild(icon);
      item.appendChild(name);

      if (bm.vis === 'admin') {
        var badge = document.createElement('span');
        badge.className = 'adm-badge';
        badge.textContent = 'ADM';
        item.appendChild(badge);
      }
      if (isBlocked(bm.url)) {
        var tag = document.createElement('span');
        tag.className = 'blocked-tag';
        tag.textContent = '새 창';
        item.appendChild(tag);
      }

      item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
        item.classList.add('active');
        openPage(bm.url);
      });
      item.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function() { showHoverCard(bm, item); }, 400);
      });
      item.addEventListener('mouseleave', function() {
        clearTimeout(hoverTimer);
        hideHoverCard();
      });

      sec.appendChild(item);
    });
    navList.appendChild(sec);
  }

  /* ═══════════════════════════════════════
     호버 카드
     ═══════════════════════════════════════ */
  function showHoverCard(bm, el) {
    hoverFav.src = faviconUrl(bm.url);
    hoverFav.onerror = function() { this.style.display = 'none'; };
    hoverFav.style.display = 'inline-block';
    hoverName.textContent = bm.name;
    hoverUrl.textContent = getHostname(bm.url);
    hoverDesc.textContent = bm.desc || '';
    hoverTag.innerHTML = isBlocked(bm.url) ? '⚠ 새 창으로 열림' : '';
    hoverCard.classList.add('show');
    positionHoverCard(el);
  }

  function hideHoverCard() { hoverCard.classList.remove('show'); }

  function positionHoverCard(el) {
    var r = el.getBoundingClientRect();
    var cardW = hoverCard.offsetWidth;
    var cardH = hoverCard.offsetHeight;
    var left = r.right + 10;
    var top = r.top + r.height / 2 - cardH / 2;
    if (left + cardW > window.innerWidth - 10) left = r.left - cardW - 10;
    if (top < 5) top = 5;
    if (top + cardH > window.innerHeight - 5) top = window.innerHeight - cardH - 5;
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
  }

  /* ═══════════════════════════════════════
     관리 모달 — 즐겨찾기 목록 렌더링
     ═══════════════════════════════════════ */
  function renderBmList() {
    bmSections.innerHTML = '';
    var profile = Auth.getProfile();

    if (Auth.isAdmin()) {
      renderBmSection('공개', 'public', false);
      renderBmSection('관리자 전용', 'admin', false);
      renderBmSection('개인', 'private', true);
    } else {
      renderBmSection('내 북마크', 'private', true);
    }
  }

  function renderBmSection(label, vis, ownerOnly) {
    var profile = Auth.getProfile();
    var items;
    if (ownerOnly) {
      items = bookmarks.filter(function(b) { return b.vis === vis && b.owner === profile.email; });
    } else {
      items = bookmarks.filter(function(b) { return b.vis === vis; });
    }
    items.sort(function(a, b) { return (a.ord || 0) - (b.ord || 0); });

    var block = document.createElement('div');
    block.className = 'bm-block';

    var header = document.createElement('div');
    header.className = 'bm-block-header bm-block-' + vis;
    header.innerHTML = '<span class="bm-block-dot"></span> ' + label;
    block.appendChild(header);

    var list = document.createElement('div');
    list.className = 'bm-block-list';

    if (items.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'bm-empty';
      empty.textContent = '등록된 항목이 없습니다.';
      list.appendChild(empty);
    }

    items.forEach(function(bm) {
      var row = document.createElement('div');
      row.className = 'bm-row';
      row.draggable = true;
      row.dataset.id = bm.id;
      row.dataset.vis = vis;

      var favicon = document.createElement('img');
      favicon.className = 'bm-favicon';
      favicon.src = faviconUrl(bm.url, 32);
      favicon.alt = '';
      favicon.onerror = function() { handleImgError(this, bm.url, bm.name); };

      var infoWrap = document.createElement('div');
      infoWrap.className = 'bm-info-wrap';
      var info = document.createElement('span');
      info.className = 'bm-info';
      info.textContent = bm.name;
      var sub = document.createElement('span');
      sub.className = 'bm-sub';
      sub.textContent = getHostname(bm.url);
      infoWrap.appendChild(info);
      infoWrap.appendChild(sub);

      row.appendChild(favicon);
      row.appendChild(infoWrap);

      if (isBlocked(bm.url)) {
        var tag = document.createElement('span');
        tag.className = 'blocked-tag';
        tag.textContent = '새 창';
        row.appendChild(tag);
      }

      // 편집 가능 여부: 관리자이거나 본인 항목
      var canEdit = Auth.isAdmin() || (bm.owner === profile.email);
      if (canEdit) {
        var edit = document.createElement('button');
        edit.className = 'bm-btn';
        edit.title = '편집';
        edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
        edit.addEventListener('click', function(e) { e.stopPropagation(); openEditModal(bm); });

        var del = document.createElement('button');
        del.className = 'bm-btn bm-del';
        del.title = '삭제';
        del.textContent = '\u00D7';
        del.addEventListener('click', function(e) { e.stopPropagation(); confirmDelete(bm); });

        row.appendChild(edit);
        row.appendChild(del);
      }

      // 드래그 앤 드롭
      row.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', bm.id);
        e.dataTransfer.setData('text/vis', vis);
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', function() { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function(e) { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', function() { row.classList.remove('drag-over'); });
      row.addEventListener('drop', function(e) {
        e.preventDefault();
        row.classList.remove('drag-over');
        var dragId = e.dataTransfer.getData('text/plain');
        var dragVis = e.dataTransfer.getData('text/vis');
        if (dragVis !== vis || dragId === bm.id) return;
        reorderInSection(dragId, bm.id, vis, ownerOnly);
      });

      list.appendChild(row);
    });

    block.appendChild(list);
    bmSections.appendChild(block);
  }

  async function reorderInSection(dragId, targetId, vis, ownerOnly) {
    var profile = Auth.getProfile();
    var sectionItems;
    if (ownerOnly) {
      sectionItems = bookmarks.filter(function(b) { return b.vis === vis && b.owner === profile.email; });
    } else {
      sectionItems = bookmarks.filter(function(b) { return b.vis === vis; });
    }
    sectionItems.sort(function(a, b) { return (a.ord || 0) - (b.ord || 0); });

    var dragIdx = sectionItems.findIndex(function(b) { return b.id === dragId; });
    var targetIdx = sectionItems.findIndex(function(b) { return b.id === targetId; });
    if (dragIdx === -1 || targetIdx === -1) return;

    var moved = sectionItems.splice(dragIdx, 1)[0];
    sectionItems.splice(targetIdx, 0, moved);
    sectionItems.forEach(function(b, i) { b.ord = i; });

    renderBmList();
    renderNav();

    // 서버 동기화 (백그라운드)
    try {
      await Crud.updateOrder(sectionItems.map(function(b) { return { id: b.id, ord: b.ord }; }));
    } catch (e) {
      console.warn('순서 저장 실패:', e.message);
    }
  }

  /* ═══════════════════════════════════════
     북마크 추가
     ═══════════════════════════════════════ */
  inputUrl.addEventListener('input', function() {
    var url = inputUrl.value.trim();
    if (!url) {
      previewFav.style.display = 'none';
      inputHint.textContent = '';
      return;
    }
    var full = url.startsWith('http') ? url : 'https://' + url;
    previewFav.src = faviconUrl(full);
    previewFav.style.display = 'inline-block';
    previewFav.onerror = function() { this.style.display = 'none'; };

    if (isBlocked(full)) {
      inputHint.textContent = '⚠ 이 사이트는 iframe 차단됨 (새 창에서 열림)';
      inputHint.style.color = '#f0883e';
    } else {
      inputHint.textContent = '';
      inputHint.style.color = '';
    }

    if (!inputName.value.trim()) {
      var h = getHostname(full);
      if (h) inputName.value = h.replace(/^www\./, '');
    }
  });

  btnAddBm.addEventListener('click', async function() {
    var url = inputUrl.value.trim();
    var name = inputName.value.trim();
    var desc = inputDesc.value.trim();
    if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }

    var full = url.startsWith('http') ? url : 'https://' + url;
    var profile = Auth.getProfile();
    var vis = Auth.isAdmin() ? inputVis.value : 'private';

    btnAddBm.disabled = true;
    addLoading.style.display = 'block';

    try {
      var newBm = await Crud.create({
        name: name,
        url: full,
        desc: desc,
        vis: vis,
        owner: profile.email,
        ord: bookmarks.length
      });
      bookmarks.push(newBm);

      inputUrl.value = '';
      inputName.value = '';
      inputDesc.value = '';
      inputHint.textContent = '';
      previewFav.style.display = 'none';

      renderBmList();
      renderNav();
      toast('추가 완료');
    } catch (e) {
      toast('추가 실패: ' + e.message);
    } finally {
      btnAddBm.disabled = false;
      addLoading.style.display = 'none';
    }
  });

  /* ═══════════════════════════════════════
     편집 모달
     ═══════════════════════════════════════ */
  function openEditModal(bm) {
    editingItem = bm;
    editUrl.value = bm.url;
    editName.value = bm.name;
    editDesc.value = bm.desc || '';
    editVis.value = bm.vis;
    editFav.src = faviconUrl(bm.url);
    editFav.style.display = 'inline-block';
    editFav.onerror = function() { this.style.display = 'none'; };
    editVisRow.style.display = Auth.isAdmin() ? 'flex' : 'none';
    editOverlay.classList.add('show');
  }

  function closeEditModal() { editOverlay.classList.remove('show'); editingItem = null; }

  editUrl.addEventListener('input', function() {
    var url = editUrl.value.trim();
    if (url) {
      editFav.src = faviconUrl(url.startsWith('http') ? url : 'https://' + url);
      editFav.style.display = 'inline-block';
    } else {
      editFav.style.display = 'none';
    }
  });

  btnSaveEdit.addEventListener('click', async function() {
    if (!editingItem) return;
    var url = editUrl.value.trim();
    var name = editName.value.trim();
    var desc = editDesc.value.trim();
    if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }

    var full = url.startsWith('http') ? url : 'https://' + url;
    var updates = { name: name, url: full, desc: desc };
    if (Auth.isAdmin()) updates.vis = editVis.value;

    btnSaveEdit.disabled = true;
    editLoading.style.display = 'block';

    try {
      await Crud.update(editingItem.id, updates);

      // 로컬 상태 업데이트
      var idx = bookmarks.findIndex(function(b) { return b.id === editingItem.id; });
      if (idx !== -1) {
        bookmarks[idx].name = name;
        bookmarks[idx].url = full;
        bookmarks[idx].desc = desc;
        if (updates.vis) bookmarks[idx].vis = updates.vis;
      }

      renderBmList();
      renderNav();
      closeEditModal();
      toast('수정 완료');
    } catch (e) {
      toast('수정 실패: ' + e.message);
    } finally {
      btnSaveEdit.disabled = false;
      editLoading.style.display = 'none';
    }
  });

  btnCloseEdit.addEventListener('click', closeEditModal);
  editOverlay.addEventListener('click', function(e) { if (e.target === editOverlay) closeEditModal(); });

  /* ═══════════════════════════════════════
     삭제
     ═══════════════════════════════════════ */
  var deleteTarget = null;

  function confirmDelete(bm) {
    deleteTarget = bm;
    if (!confirm(bm.name + ' 을(를) 삭제하시겠습니까?')) {
      deleteTarget = null;
      return;
    }
    doDelete();
  }

  async function doDelete() {
    if (!deleteTarget) return;
    try {
      await Crud.remove(deleteTarget.id);
      bookmarks = bookmarks.filter(function(b) { return b.id !== deleteTarget.id; });
      renderBmList();
      renderNav();
      toast('삭제 완료');
    } catch (e) {
      toast('삭제 실패: ' + e.message);
    }
    deleteTarget = null;
  }

  /* ═══════════════════════════════════════
     관리 모달
     ═══════════════════════════════════════ */
  btnManager.addEventListener('click', function() {
    // 탭 초기화
    document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
    panelBookmarks.style.display = '';
    panelAdmin.style.display = 'none';

    tabAdmin.style.display = Auth.isAdmin() ? '' : 'none';
    inputVis.style.display = Auth.isAdmin() ? '' : 'none';

    renderBmList();
    modalOverlay.classList.add('show');
  });

  btnCloseModal.addEventListener('click', function() { modalOverlay.classList.remove('show'); });
  modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) modalOverlay.classList.remove('show'); });

  // 탭 전환
  document.querySelectorAll('.modal-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var t = tab.dataset.tab;
      panelBookmarks.style.display = (t === 'bookmarks') ? '' : 'none';
      panelAdmin.style.display = (t === 'admin') ? '' : 'none';
      if (t === 'admin') loadAdminList();
    });
  });

  /* ═══════════════════════════════════════
     관리자 목록
     ═══════════════════════════════════════ */
  async function loadAdminList() {
    adminLoading.style.display = 'block';
    adminList.innerHTML = '';
    try {
      var members = await Admin.loadMembers();
      adminCount.textContent = members.length + '명';
      var profile = Auth.getProfile();

      members.forEach(function(m) {
        var item = document.createElement('div');
        item.className = 'admin-item';
        var isMe = (m.email === profile.email);
        var initial = (m.displayName || '?').charAt(0).toUpperCase();

        item.innerHTML =
          '<div class="admin-avatar">' + escHtml(initial) + '</div>' +
          '<div class="admin-info">' +
            '<div class="admin-info-name">' + escHtml(m.displayName) + (isMe ? '<span class="me-badge">(나)</span>' : '') + '</div>' +
            '<div class="admin-info-email">' + escHtml(m.email) + '</div>' +
          '</div>' +
          (!isMe ? '<button class="btn-admin-del" data-uid="' + m.id + '">제거</button>' : '');

        adminList.appendChild(item);
      });

      // 제거 버튼 이벤트
      adminList.querySelectorAll('.btn-admin-del').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var uid = btn.dataset.uid;
          if (!confirm('이 관리자를 제거하시겠습니까?')) return;
          btn.disabled = true;
          btn.textContent = '처리중...';
          try {
            await Admin.removeMember(uid);
            toast('관리자 제거 완료');
            loadAdminList();
          } catch (e) {
            toast('제거 실패: ' + e.message);
            btn.disabled = false;
            btn.textContent = '제거';
          }
        });
      });
    } catch (e) {
      adminList.innerHTML = '<div class="bm-empty">목록 로드 실패: ' + escHtml(e.message) + '</div>';
    } finally {
      adminLoading.style.display = 'none';
    }
  }

  // 관리자 추가
  btnAddAdmin.addEventListener('click', async function() {
    var email = adminEmail.value.trim();
    if (!email) { toast('이메일을 입력하세요'); return; }

    btnAddAdmin.disabled = true;
    adminAddLoading.style.display = 'block';

    try {
      var results = await Admin.addMember(email);
      if (results.member === 'added' || results.member === 'exists') {
        toast('관리자 추가 완료: ' + email);
        adminEmail.value = '';
        loadAdminList();
      } else {
        toast('추가 중 문제 발생: ' + results.member);
      }
    } catch (e) {
      toast('추가 실패: ' + e.message);
    } finally {
      btnAddAdmin.disabled = false;
      adminAddLoading.style.display = 'none';
    }
  });

  /* ═══════════════════════════════════════
     로그아웃
     ═══════════════════════════════════════ */
  btnLogout.addEventListener('click', async function() {
    try {
      await Auth.logout();
    } catch (e) {
      console.warn('로그아웃 오류:', e);
    }
    appWrap.style.display = 'none';
    loginScreen.style.display = 'flex';
  });

  /* ═══════════════════════════════════════
     ESC 키
     ═══════════════════════════════════════ */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (editOverlay.classList.contains('show')) closeEditModal();
      else if (modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
    }
  });

  /* ═══════════════════════════════════════
     앱 표시
     ═══════════════════════════════════════ */
  function showApp() {
    var profile = Auth.getProfile();
    footerUserName.textContent = profile.displayName;
    footerUserRole.textContent = Auth.isAdmin() ? '관리자' : '사용자';
    userAvatar.textContent = profile.initials;
    document.body.classList.toggle('is-admin', Auth.isAdmin());

    splashScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    appWrap.style.display = 'flex';
    showWelcome();
  }

  async function loadBookmarks() {
    try {
      bookmarks = await Crud.readAll();
      renderNav();
    } catch (e) {
      console.error('북마크 로드 실패:', e);
      toast('북마크 로드 실패: ' + e.message);
    }
  }

  /* ═══════════════════════════════════════
     초기화 (앱 진입점)
     ═══════════════════════════════════════ */
  async function bootstrap() {
    try {
      var result = await Auth.initialize();

      if (result.success) {
        showApp();
        loadBookmarks(); // 비동기로 병렬 로드 (화면은 먼저 표시)
      } else {
        // 자동 로그인 실패 → 로그인 화면 표시
        splashScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    } catch (e) {
      console.error('초기화 오류:', e);
      splashScreen.style.display = 'none';
      loginScreen.style.display = 'flex';
    }
  }

  // 로그인 버튼
  btnLogin.addEventListener('click', async function() {
    loginError.textContent = '';
    try {
      await Auth.loginAndInit();
      showApp();
      loadBookmarks();
    } catch (e) {
      loginError.textContent = '로그인 실패: ' + (e.message || '알 수 없는 오류');
    }
  });

  // 시작!
  bootstrap();

})();
