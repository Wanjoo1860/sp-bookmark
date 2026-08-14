// ============================================================
// 메인 앱 로직 — UI, 사이드바, iframe, 모달, CRUD
// ============================================================
(function() {
'use strict';

// ─── 유틸 ───
function getHostname(url) {
    try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase(); }
    catch(e) { return ''; }
}

// ─── URL 필드 유틸 (SharePoint 하이퍼링크 타입 대응) ───
function extractUrl(field) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field.Url) return field.Url;
    return String(field);
}

function isBlocked(url) {
    var h = getHostname(url);
    if (!h) return false;
    for (var i = 0; i < KNOWN_BLOCKED.length; i++) {
        if (h === KNOWN_BLOCKED[i] || h.endsWith('.' + KNOWN_BLOCKED[i])) return true;
    }
    for (var j = 0; j < APP.dynamicBlocked.length; j++) {
        if (h === APP.dynamicBlocked[j] || h.endsWith('.' + APP.dynamicBlocked[j])) return true;
    }
    return false;
}

function addToDynamicBlocked(url) {
    var h = getHostname(url);
    if (h && APP.dynamicBlocked.indexOf(h) === -1) {
        APP.dynamicBlocked.push(h);
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
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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

// ─── 토스트 ───
window.toast = function(msg) {
    var el = document.getElementById('toastMsg');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
};

// ─── DOM 참조 ───
var sidebar, navList, contentFrame, welcomeScreen, errorScreen, loadingScreen;
var errorDomain, btnOpenNew, modalOverlay, editOverlay, hoverCard;

function initDOM() {
    sidebar = document.getElementById('sidebar');
    navList = document.getElementById('navList');
    contentFrame = document.getElementById('contentFrame');
    welcomeScreen = document.getElementById('welcomeScreen');
    errorScreen = document.getElementById('errorScreen');
    loadingScreen = document.getElementById('loadingScreen');
    errorDomain = document.getElementById('errorDomain');
    btnOpenNew = document.getElementById('btnOpenNew');
    modalOverlay = document.getElementById('modalOverlay');
    editOverlay = document.getElementById('editOverlay');
    hoverCard = document.getElementById('hoverCard');
}

// ─── 화면 전환 (iframe 영역) ───
function hideAllScreens() {
    welcomeScreen.style.display = 'none';
    errorScreen.style.display = 'none';
    loadingScreen.style.display = 'none';
    contentFrame.style.display = 'none';
}
function showWelcome() { hideAllScreens(); welcomeScreen.style.display = 'flex'; }
function showError(url) { hideAllScreens(); errorDomain.textContent = getHostname(url) || url; errorScreen.style.display = 'flex'; }
function showLoading() { hideAllScreens(); loadingScreen.style.display = 'flex'; }
function showFrame() { hideAllScreens(); contentFrame.style.display = 'block'; }

// ─── iframe 체크 ───
function clearChecks() {
    if (APP.checkTimer) { clearTimeout(APP.checkTimer); APP.checkTimer = null; }
    if (APP.loadTimer) { clearTimeout(APP.loadTimer); APP.loadTimer = null; }
    contentFrame.onload = null;
    contentFrame.onerror = null;
}

function openPage(url) {
    clearChecks();
    APP.pageCallId++;
    var myId = APP.pageCallId;

    if (!url.startsWith('http')) url = 'https://' + url;
    APP.currentUrl = url;

    if (isBlocked(url)) {
        contentFrame.src = 'about:blank';
        showError(url);
        return;
    }

    showLoading();
    var startTime = Date.now();

    contentFrame.onload = function() {
        if (myId !== APP.pageCallId) return;
        clearChecks();
        var elapsed = Date.now() - startTime;
        try {
            var loc = contentFrame.contentWindow.location.href;
            if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
        } catch(e) {}
        if (elapsed < 200) {
            APP.checkTimer = setTimeout(function() {
                if (myId !== APP.pageCallId) return;
                try {
                    var loc = contentFrame.contentWindow.location.href;
                    if (loc === 'about:blank') { addToDynamicBlocked(url); showError(url); return; }
                } catch(e) {}
                showFrame();
            }, 300);
        } else {
            showFrame();
        }
    };

    contentFrame.onerror = function() {
        if (myId !== APP.pageCallId) return;
        clearChecks(); addToDynamicBlocked(url); showError(url);
    };

    APP.loadTimer = setTimeout(function() {
        if (myId !== APP.pageCallId) return;
        clearChecks(); addToDynamicBlocked(url); showError(url);
    }, 12000);

    contentFrame.src = url;
}

// CSP violation
document.addEventListener('securitypolicyviolation', function(e) {
    if (e.blockedURI && APP.currentUrl) {
        var bh = getHostname(e.blockedURI);
        var ch = getHostname(APP.currentUrl);
        if (bh === ch) { clearChecks(); addToDynamicBlocked(APP.currentUrl); showError(APP.currentUrl); }
    }
});

// ─── 사이드바 토글 ───
function isMobile() { return window.innerWidth <= 768; }

// ─── 가시성 판별 ───
function visible(bm) {
    if (!APP.currentUser) return false;
    var f = bm.fields || bm;
    var vis = f.Visibility || 'public';
    if (vis === 'public') return true;
    if (vis === 'admin' && APP.currentUserRole === 'admin') return true;
    if (vis === 'private') {
        var owner = f.Owner;
        if (typeof owner === 'string' && owner.toLowerCase() === APP.currentUserEmail) return true;
    }
    return false;
}

// ─── 호버 카드 ───
function showHoverCard(bm, targetEl) {
    var f = bm.fields || bm;
    var url = extractUrl(f.Url);
    var hFav = document.getElementById('hoverFav');
    var hName = document.getElementById('hoverName');
    var hUrl = document.getElementById('hoverUrl');
    var hDesc = document.getElementById('hoverDesc');
    var hTag = document.getElementById('hoverTag');

    hFav.src = faviconUrl(url);
    hFav.onerror = function() { this.style.display = 'none'; };
    hFav.style.display = 'inline-block';
    hName.textContent = f.Title || '';
    hUrl.textContent = getHostname(url);
    hDesc.textContent = f.Description || '';

    if (isBlocked(url)) {
        hTag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 새 창으로 열림';
    } else {
        hTag.textContent = '';
    }

    hoverCard.classList.add('show');
    positionHoverCard(targetEl);
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

// ============================================================
// 사이드바 렌더링
// ============================================================
function renderNav() {
    navList.innerHTML = '';
    var pubItems = [];
    var admItems = [];
    var privItems = [];

    APP.bookmarks.forEach(function(bm) {
        if (!visible(bm)) return;
        var f = bm.fields || bm;
        var vis = f.Visibility || 'public';
        if (vis === 'public') pubItems.push(bm);
        else if (vis === 'admin') admItems.push(bm);
        else if (vis === 'private') privItems.push(bm);
    });

    function sortByOrder(a, b) {
        var oa = (a.fields || a).SortOrder || 0;
        var ob = (b.fields || b).SortOrder || 0;
        return oa - ob;
    }

    pubItems.sort(sortByOrder);
    admItems.sort(sortByOrder);
    privItems.sort(sortByOrder);

    makeSection('공개', pubItems, 'sec-public');
    if (admItems.length > 0) makeSection('관리자', admItems, 'sec-admin');
    if (privItems.length > 0) makeSection('개인', privItems, 'sec-private');
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
        var f = bm.fields || bm;
        var url = extractUrl(f.Url);
        var title = f.Title || '';

        var item = document.createElement('div');
        item.className = 'nav-item';
        item.dataset.id = bm.id;

        var icon = document.createElement('img');
        icon.className = 'nav-icon';
        icon.src = f.IconUrl || faviconUrl(url);
        icon.alt = '';
        icon.onerror = function() { handleImgError(this, url, title); };

        var name = document.createElement('span');
        name.className = 'nav-name';
        name.textContent = title;

        item.appendChild(icon);
        item.appendChild(name);

        if ((f.Visibility || 'public') === 'admin') {
            var badge = document.createElement('span');
            badge.className = 'adm-badge';
            badge.textContent = 'ADM';
            item.appendChild(badge);
        }
        if (isBlocked(url)) {
            var tag = document.createElement('span');
            tag.className = 'blocked-tag';
            tag.textContent = '새 창';
            item.appendChild(tag);
        }

        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
            item.classList.add('active');
            if (isBlocked(url)) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                openPage(url);
            }
            if (isMobile() && sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
            }
        });

        item.addEventListener('mouseenter', function() {
            clearTimeout(APP.hoverTimer);
            APP.hoverTimer = setTimeout(function() { showHoverCard(bm, item); }, 400);
        });
        item.addEventListener('mouseleave', function() {
            clearTimeout(APP.hoverTimer);
            hideHoverCard();
        });

        sec.appendChild(item);
    });

    navList.appendChild(sec);
}

// ============================================================
// 북마크 로드 (SharePoint List)
// ============================================================
window.loadBookmarks = async function() {
    try {
        var url = CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                  '/lists/' + CONFIG.bookmarksListId +
                  '/items?$expand=fields&$top=999&$orderby=fields/SortOrder asc';
        var result = await graphGet(url);
        APP.bookmarks = result.value || [];
        renderNav();
    } catch (e) {
        // orderby 실패 시 정렬 없이 재시도
        try {
            var url2 = CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                      '/lists/' + CONFIG.bookmarksListId +
                      '/items?$expand=fields&$top=999';
            var result2 = await graphGet(url2);
            APP.bookmarks = result2.value || [];
            renderNav();
        } catch (e2) {
            toast('북마크 로드 실패: ' + e2.message);
        }
    }
};

// ============================================================
// 북마크 추가
// ============================================================
async function addBookmark() {
    var inputUrl = document.getElementById('inputUrl');
    var inputName = document.getElementById('inputName');
    var inputDesc = document.getElementById('inputDesc');
    var inputVis = document.getElementById('inputVis');

    var url = inputUrl.value.trim();
    var name = inputName.value.trim();
    var desc = inputDesc.value.trim();
    var vis = inputVis.value;

    if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;

    // 일반 사용자는 개인만 가능
    if (APP.currentUserRole !== 'admin') vis = 'private';

    var maxOrder = 0;
    APP.bookmarks.forEach(function(b) {
        var o = (b.fields || b).SortOrder || 0;
        if (o > maxOrder) maxOrder = o;
    });

    var fields = {
        Title: name,
        Url: url,
        Description: desc,
        Visibility: vis,
        Owner: APP.currentUserEmail,
        SortOrder: maxOrder + 1
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
        document.getElementById('previewFav').style.display = 'none';
        document.getElementById('inputHint').textContent = '';

        await loadBookmarks();
        renderBmList();
    } catch (e) {
        toast('추가 실패: ' + e.message);
    }
}

// ============================================================
// 북마크 삭제
// ============================================================
async function deleteBookmark(id) {
    if (!confirm('이 북마크를 삭제하시겠습니까?')) return;
    try {
        await graphDelete(
            CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
            '/lists/' + CONFIG.bookmarksListId + '/items/' + id
        );
        toast('삭제 완료');
        await loadBookmarks();
        renderBmList();
    } catch (e) {
        toast('삭제 실패: ' + e.message);
    }
}

// ============================================================
// 북마크 편집 모달
// ============================================================
function openEditModal(bm) {
    var f = bm.fields || bm;
    var bmUrl = extractUrl(f.Url);
    APP.editingId = bm.id;
    document.getElementById('editUrl').value = bmUrl;
    document.getElementById('editName').value = f.Title || '';
    document.getElementById('editDesc').value = f.Description || '';
    document.getElementById('editVis').value = f.Visibility || 'public';

    var editFav = document.getElementById('editFav');
    editFav.src = faviconUrl(bmUrl);
    editFav.style.display = 'inline-block';
    editFav.onerror = function() { this.style.display = 'none'; };

    var editVisRow = document.getElementById('editVisRow');
    editVisRow.style.display = (APP.currentUserRole === 'admin') ? 'flex' : 'none';

    editOverlay.classList.add('show');
}

function closeEditModal() {
    editOverlay.classList.remove('show');
    APP.editingId = null;
}

async function saveEdit() {
    if (!APP.editingId) return;

    var url = document.getElementById('editUrl').value.trim();
    var name = document.getElementById('editName').value.trim();
    var desc = document.getElementById('editDesc').value.trim();
    var vis = document.getElementById('editVis').value;

    if (!url || !name) { toast('URL과 이름을 입력하세요'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;
    if (APP.currentUserRole !== 'admin') vis = undefined; // 일반 사용자는 vis 변경 불가

    var fields = { Title: name, Url: url, Description: desc };
    if (vis) fields.Visibility = vis;

    try {
        await graphPatch(
            CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
            '/lists/' + CONFIG.bookmarksListId + '/items/' + APP.editingId + '/fields',
            fields
        );
        toast('수정 완료');
        closeEditModal();
        await loadBookmarks();
        renderBmList();
    } catch (e) {
        toast('수정 실패: ' + e.message);
    }
}

// ============================================================
// 설정 모달 — 북마크 섹션별 렌더링
// ============================================================
function renderBmList() {
    var bmSections = document.getElementById('bmSections');
    bmSections.innerHTML = '';

    if (APP.currentUserRole === 'admin') {
        renderBmSection(bmSections, '공개', 'public', false);
        renderBmSection(bmSections, '관리자 전용', 'admin', false);
        renderBmSection(bmSections, '개인 (내 북마크)', 'private', true);
    } else {
        renderBmSection(bmSections, '내 북마크', 'private', true);
    }
}

function renderBmSection(container, label, vis, ownerOnly) {
    var items = APP.bookmarks.filter(function(bm) {
        var f = bm.fields || bm;
        var bVis = f.Visibility || 'public';
        if (bVis !== vis) return false;
        if (ownerOnly) {
            var owner = f.Owner;
            if (typeof owner !== 'string') return false;
            return owner.toLowerCase() === APP.currentUserEmail;
        }
        return true;
    });

    items.sort(function(a, b) {
        return ((a.fields || a).SortOrder || 0) - ((b.fields || b).SortOrder || 0);
    });

    var block = document.createElement('div');
    block.className = 'bm-block';

    var header = document.createElement('div');
    header.className = 'bm-block-header bm-block-' + vis;
    header.innerHTML = '<span class="bm-block-dot"></span> ' + escHtml(label);
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
        var f = bm.fields || bm;
        var bmUrl = extractUrl(f.Url);
        var row = document.createElement('div');
        row.className = 'bm-row';
        row.draggable = true;
        row.dataset.id = bm.id;
        row.dataset.vis = vis;

        var favicon = document.createElement('img');
        favicon.className = 'bm-favicon';
        favicon.src = f.IconUrl || faviconUrl(bmUrl, 32);
        favicon.alt = '';
        favicon.onerror = function() { handleImgError(this, bmUrl, f.Title || ''); };

        var infoWrap = document.createElement('div');
        infoWrap.className = 'bm-info-wrap';
        var info = document.createElement('span');
        info.className = 'bm-info';
        info.textContent = f.Title || '';
        var sub = document.createElement('span');
        sub.className = 'bm-sub';
        sub.textContent = getHostname(bmUrl);
        infoWrap.appendChild(info);
        infoWrap.appendChild(sub);

        row.appendChild(favicon);
        row.appendChild(infoWrap);

        if (isBlocked(bmUrl)) {
            var tag = document.createElement('span');
            tag.className = 'blocked-tag';
            tag.textContent = '새 창';
            row.appendChild(tag);
        }

        // 편집 버튼
        var canEdit = (APP.currentUserRole === 'admin') ||
                      (typeof f.Owner === 'string' && f.Owner.toLowerCase() === APP.currentUserEmail);
        if (canEdit) {
            var edit = document.createElement('button');
            edit.className = 'bm-btn';
            edit.title = '편집';
            edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
            edit.addEventListener('click', function(e) { e.stopPropagation(); openEditModal(bm); });
            row.appendChild(edit);

            var del = document.createElement('button');
            del.className = 'bm-btn bm-del';
            del.title = '삭제';
            del.textContent = '\u00D7';
            del.addEventListener('click', function(e) { e.stopPropagation(); deleteBookmark(bm.id); });
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
            reorderBookmarks(dragId, bm.id, vis, ownerOnly);
        });

        list.appendChild(row);
    });

    block.appendChild(list);
    container.appendChild(block);
}

// ─── 드래그 정렬 저장 ───
async function reorderBookmarks(dragId, targetId, vis, ownerOnly) {
    var items = APP.bookmarks.filter(function(bm) {
        var f = bm.fields || bm;
        if ((f.Visibility || 'public') !== vis) return false;
        if (ownerOnly) {
            var owner = f.Owner;
            return typeof owner === 'string' && owner.toLowerCase() === APP.currentUserEmail;
        }
        return true;
    });

    items.sort(function(a, b) {
        return ((a.fields || a).SortOrder || 0) - ((b.fields || b).SortOrder || 0);
    });

    var dragIdx = items.findIndex(function(b) { return b.id == dragId; });
    var targetIdx = items.findIndex(function(b) { return b.id == targetId; });
    if (dragIdx === -1 || targetIdx === -1) return;

    var moved = items.splice(dragIdx, 1)[0];
    items.splice(targetIdx, 0, moved);

    // SortOrder 업데이트
    var promises = [];
    items.forEach(function(bm, i) {
        var oldOrder = (bm.fields || bm).SortOrder || 0;
        if (oldOrder !== i) {
            if (bm.fields) bm.fields.SortOrder = i;
            promises.push(
                graphPatch(
                    CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                    '/lists/' + CONFIG.bookmarksListId + '/items/' + bm.id + '/fields',
                    { SortOrder: i }
                ).catch(function() {})
            );
        }
    });

    await Promise.all(promises);
    await loadBookmarks();
    renderBmList();
}

// ============================================================
// 관리자 관리
// ============================================================
async function loadAdminMembers() {
    try {
        var data = await graphGet(
            CONFIG.graphUrl + '/groups/' + CONFIG.groupId +
            '/members?$select=id,displayName,mail,userPrincipalName'
        );
        APP.adminMembers = data.value || [];
        renderAdminList();
    } catch (e) {
        toast('관리자 목록 조회 실패: ' + e.message);
    }
}

function renderAdminList() {
    var adminList = document.getElementById('adminList');
    var adminCount = document.getElementById('adminCount');
    adminList.innerHTML = '';
    adminCount.textContent = APP.adminMembers.length + '명';

    APP.adminMembers.forEach(function(m) {
        var email = m.mail || m.userPrincipalName || '';
        var isSelf = (m.id === APP.currentUserId);
        var initial = (m.displayName || '?').charAt(0).toUpperCase();

        var item = document.createElement('div');
        item.className = 'user-item';

        item.innerHTML =
            '<div class="user-avatar">' + escHtml(initial) + '</div>' +
            '<div class="user-info">' +
                '<div class="user-info-name">' + escHtml(m.displayName || '') +
                    (isSelf ? '<span class="me-badge">(나)</span>' : '') +
                '</div>' +
                '<div class="user-info-email">' + escHtml(email) + '</div>' +
            '</div>';

        if (!isSelf) {
            var btn = document.createElement('button');
            btn.className = 'btn-user-del';
            btn.textContent = '제거';
            btn.addEventListener('click', function() { removeAdmin(m.id, m.displayName || '', email); });
            item.appendChild(btn);
        }

        adminList.appendChild(item);
    });
}

async function searchAdmin() {
    var query = document.getElementById('adminSearchInput').value.trim();
    if (!query) { toast('검색어를 입력하세요'); return; }

    var container = document.getElementById('adminSearchResults');
    container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">검색 중...</div>';

    try {
        var url = CONFIG.graphUrl + '/users?$filter=startswith(displayName,\'' +
                  encodeURIComponent(query) + '\') or startswith(mail,\'' +
                  encodeURIComponent(query) + '\') or startswith(userPrincipalName,\'' +
                  encodeURIComponent(query) + '\')&$top=10&$select=id,displayName,mail,userPrincipalName';
        var result = await graphGet(url);
        renderAdminSearchResults(result.value || []);
    } catch (e) {
        try {
            var user = await graphGet(CONFIG.graphUrl + '/users/' + encodeURIComponent(query));
            renderAdminSearchResults([user]);
        } catch (e2) {
            container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">검색 결과가 없습니다.</div>';
        }
    }
}

function renderAdminSearchResults(users) {
    var container = document.getElementById('adminSearchResults');
    if (users.length === 0) {
        container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">검색 결과가 없습니다.</div>';
        return;
    }
    container.innerHTML = '';
    users.forEach(function(user) {
        var email = user.mail || user.userPrincipalName || '';
        var item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = '<span class="search-result-info"><strong>' + escHtml(user.displayName || '') +
                         '</strong> (' + escHtml(email) + ')</span>';

        var btn = document.createElement('button');
        btn.className = 'btn-add';
        btn.textContent = '추가';
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '11px';
        btn.addEventListener('click', function() { addAdmin(user.id, user.displayName || ''); });
        item.appendChild(btn);
        container.appendChild(item);
    });
}

async function addAdmin(userId, displayName) {
    try {
        var ref = { '@odata.id': CONFIG.graphUrl + '/directoryObjects/' + userId };
        try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/$ref', ref); } catch(e) {}
        try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/$ref', ref); } catch(e) {}

        toast(displayName + ' 관리자로 추가 완료');
        document.getElementById('adminSearchResults').innerHTML = '';
        document.getElementById('adminSearchInput').value = '';
        await loadAdminMembers();
    } catch (e) {
        toast('관리자 추가 실패: ' + e.message);
    }
}

async function removeAdmin(userId, displayName, email) {
    if (!confirm(displayName + ' 님을 관리자에서 제거하시겠습니까?')) return;
    if (userId === APP.currentUserId) { toast('자기 자신은 제거할 수 없습니다.'); return; }

    try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/' + userId + '/$ref'); } catch(e) {}
    try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/' + userId + '/$ref'); } catch(e) {}

    toast(displayName + ' 관리자에서 제거 완료');

    // 북마크 정리
    try {
        await deleteBookmarksByOwner(email, displayName);
    } catch (e) {
        console.warn('[관리자 제거] 북마크 정리 중 오류 (무시):', e.message);
    }

    await loadAdminMembers();
}

async function deleteBookmarksByOwner(ownerEmail, displayName) {
    if (!ownerEmail) return;
    ownerEmail = ownerEmail.toLowerCase();

    var matching = APP.bookmarks.filter(function(b) {
        var owner = (b.fields || b).Owner;
        if (!owner || typeof owner !== 'string') return false;
        return owner.toLowerCase() === ownerEmail;
    });

    if (matching.length === 0) return;
    if (!confirm(displayName + ' 님이 등록한 북마크 ' + matching.length + '개도 삭제하시겠습니까?')) return;

    for (var i = 0; i < matching.length; i++) {
        await graphDelete(
            CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
            '/lists/' + CONFIG.bookmarksListId + '/items/' + matching[i].id
        );
    }
    toast(matching.length + '개 북마크 삭제 완료');
    await loadBookmarks();
}

// ============================================================
// 이벤트 바인딩 (DOMContentLoaded)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    initDOM();
    showWelcome();

    // 사이드바 토글
    document.getElementById('btnToggle').addEventListener('click', function() {
        if (isMobile()) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.toggle('expanded');
        } else {
            sidebar.classList.remove('expanded');
            sidebar.classList.toggle('collapsed');
        }
    });

    // 새 창 열기
    document.getElementById('btnOpenNew').addEventListener('click', function() {
        if (APP.currentUrl) window.open(APP.currentUrl, '_blank', 'noopener,noreferrer');
    });

    // 설정 모달
    document.getElementById('btnManager').addEventListener('click', function() {
        // 탭 초기화
        document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
        document.getElementById('panelBookmarks').style.display = '';
        document.getElementById('panelUsers').style.display = 'none';

        // vis select 표시 여부
        var visRow = document.getElementById('visRow');
        var inputVis = document.getElementById('inputVis');
        if (APP.currentUserRole === 'admin') {
            inputVis.style.display = '';
        } else {
            inputVis.style.display = 'none';
        }

        renderBmList();
        modalOverlay.classList.add('show');
    });

    document.getElementById('btnCloseModal').addEventListener('click', function() {
        modalOverlay.classList.remove('show');
    });
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) modalOverlay.classList.remove('show');
    });

    // 모달 탭 전환
    document.querySelectorAll('.modal-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            var t = tab.dataset.tab;
            document.getElementById('panelBookmarks').style.display = (t === 'bookmarks') ? '' : 'none';
            document.getElementById('panelUsers').style.display = (t === 'users') ? '' : 'none';
            if (t === 'users') loadAdminMembers();
        });
    });

    // 북마크 추가
    document.getElementById('btnAddBm').addEventListener('click', addBookmark);

    // URL 입력 미리보기
    document.getElementById('inputUrl').addEventListener('input', function() {
        var url = this.value.trim();
        var previewFav = document.getElementById('previewFav');
        var inputHint = document.getElementById('inputHint');
        var inputName = document.getElementById('inputName');

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
            inputHint.textContent = '\u26A0 이 사이트는 iframe 차단됨 (새 창에서 열림)';
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

    // 편집 모달
    document.getElementById('btnSaveEdit').addEventListener('click', saveEdit);
    document.getElementById('btnCloseEdit').addEventListener('click', closeEditModal);
    editOverlay.addEventListener('click', function(e) {
        if (e.target === editOverlay) closeEditModal();
    });

    document.getElementById('editUrl').addEventListener('input', function() {
        var url = this.value.trim();
        var editFav = document.getElementById('editFav');
        if (url) {
            var full = url.startsWith('http') ? url : 'https://' + url;
            editFav.src = faviconUrl(full);
            editFav.style.display = 'inline-block';
        } else {
            editFav.style.display = 'none';
        }
    });

    // 관리자 검색
    document.getElementById('btnAdminSearch').addEventListener('click', searchAdmin);
    document.getElementById('adminSearchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') searchAdmin();
    });

    // 로그아웃
    document.getElementById('btnLogout').addEventListener('click', logout);

    // ESC 키
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (editOverlay.classList.contains('show')) closeEditModal();
            else if (modalOverlay.classList.contains('show')) modalOverlay.classList.remove('show');
        }
    });
});

})();
