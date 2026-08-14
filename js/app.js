// ============================================================
// 즐겨찾기 포털 - 메인 앱 로직
// ============================================================

// ─────────────────────────────────────────────
// 사이드바
// ─────────────────────────────────────────────

function toggleSidebar() {
    APP.sidebarOpen = !APP.sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed', !APP.sidebarOpen);
    document.getElementById('mainContent').classList.toggle('sidebar-collapsed', !APP.sidebarOpen);
}

function toggleAdminPanel() {
    var panel = document.getElementById('adminPanel');
    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        loadAdminMembers();
    } else {
        panel.style.display = 'none';
    }
}

// ─────────────────────────────────────────────
// 북마크 CRUD
// ─────────────────────────────────────────────

async function loadBookmarks() {
    try {
        var url = CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                  '/lists/' + CONFIG.bookmarksListId +
                  '/items?$expand=fields&$top=999&$orderby=fields/SortOrder asc';
        var result = await graphGet(url);
        APP.bookmarks = result.value || [];

        extractCategories();
        renderSidebarCategories();

        // 카테고리가 이미 선택되어 있으면 북마크 표시
        if (APP.selectedCategory) {
            renderBookmarks();
        }
    } catch (e) {
        showStatus('북마크 로드 실패: ' + e.message, 'error');
    }
}

function extractCategories() {
    var catSet = {};
    APP.bookmarks.forEach(function(item) {
        var f = item.fields;
        // Visibility 필터
        if (f.Visibility === 'admin' && APP.currentUserRole !== 'admin') return;
        var cat = f.Category || '기타';
        catSet[cat] = (catSet[cat] || 0) + 1;
    });
    APP.categories = Object.keys(catSet).sort();
}

function renderSidebarCategories() {
    var nav = document.getElementById('sidebarNav');
    var html = '';

    // 전체 보기
    html += '<a class="nav-item' + (APP.selectedCategory === '__all__' ? ' active' : '') +
            '" onclick="selectCategory(\'__all__\')">📋 전체 보기</a>';

    APP.categories.forEach(function(cat) {
        var isActive = (APP.selectedCategory === cat) ? ' active' : '';
        html += '<a class="nav-item' + isActive + '" onclick="selectCategory(\'' +
                cat.replace(/'/g, "\\'") + '\')">' + getCategoryIcon(cat) + ' ' + cat + '</a>';
    });

    nav.innerHTML = html;
}

function getCategoryIcon(cat) {
    var icons = {
        '업무': '💼', '개발': '💻', '디자인': '🎨', '문서': '📄',
        '커뮤니케이션': '💬', '기타': '📌', '관리': '⚙'
    };
    return icons[cat] || '🔗';
}

function selectCategory(cat) {
    APP.selectedCategory = cat;
    renderSidebarCategories();

    // 메인 영역 전환
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('bookmarkGrid').style.display = 'grid';
    renderBookmarks();
}

function renderBookmarks() {
    var container = document.getElementById('bookmarkGrid');
    var filtered = APP.bookmarks.filter(function(item) {
        var f = item.fields;
        if (f.Visibility === 'admin' && APP.currentUserRole !== 'admin') return false;
        if (APP.selectedCategory === '__all__') return true;
        return (f.Category || '기타') === APP.selectedCategory;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">이 카테고리에 등록된 북마크가 없습니다.</div>';
        return;
    }

    var html = '';
    filtered.forEach(function(item) {
        var f = item.fields;
        var iconHtml = '';
        if (f.IconUrl) {
            iconHtml = '<img src="' + f.IconUrl + '" alt="" class="bookmark-icon">';
        } else {
            var initial = (f.Title || '?').charAt(0).toUpperCase();
            iconHtml = '<div class="bookmark-icon-placeholder">' + initial + '</div>';
        }

        html += '<div class="bookmark-card">';
        html += '<a href="' + (f.Url || '#') + '" target="_blank" rel="noopener" class="bookmark-link">';
        html += iconHtml;
        html += '<div class="bookmark-info">';
        html += '<div class="bookmark-title">' + (f.Title || '') + '</div>';
        if (f.Description) {
            html += '<div class="bookmark-desc">' + f.Description + '</div>';
        }
        html += '</div>';
        html += '</a>';

        // 관리자 액션
        if (APP.currentUserRole === 'admin') {
            html += '<div class="bookmark-actions">';
            html += '<button class="btn btn-warning btn-xs" onclick="editBookmark(\'' + item.id + '\')">수정</button>';
            html += '<button class="btn btn-danger btn-xs" onclick="deleteBookmark(\'' + item.id + '\')">삭제</button>';
            html += '</div>';
        }
        html += '</div>';
    });
    container.innerHTML = html;
}

// ─── 북마크 추가/수정/삭제 ───

function toggleAddForm() {
    var form = document.getElementById('addBookmarkForm');
    if (form.style.display === 'none' || !form.style.display) {
        cancelBookmarkEdit();
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}

async function saveBookmark() {
    var editId = document.getElementById('editBookmarkId').value;
    var title = document.getElementById('inputTitle').value.trim();
    var url = document.getElementById('inputUrl').value.trim();
    var category = document.getElementById('inputCategory').value.trim();
    var description = document.getElementById('inputDescription').value.trim();
    var visibility = document.getElementById('inputVisibility').value;
    var iconUrl = document.getElementById('inputIconUrl').value.trim();
    var sortOrder = parseInt(document.getElementById('inputSortOrder').value) || 0;

    if (!title || !url) {
        showStatus('사이트 이름과 URL은 필수입니다.', 'error');
        return;
    }

    var fields = {
        Title: title,
        Url: url,
        Category: category || '기타',
        Description: description,
        Visibility: visibility,
        Owner: APP.currentUserEmail,
        SortOrder: sortOrder,
        IconUrl: iconUrl
    };

    try {
        if (editId) {
            await graphPatch(
                CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                '/lists/' + CONFIG.bookmarksListId +
                '/items/' + editId + '/fields', fields
            );
            showStatus('북마크 수정 완료', 'success');
        } else {
            await graphPost(
                CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
                '/lists/' + CONFIG.bookmarksListId + '/items',
                { fields: fields }
            );
            showStatus('북마크 추가 완료', 'success');
            await autoRegisterUser();
        }
        cancelBookmarkEdit();
        await loadBookmarks();
    } catch (e) {
        showStatus('저장 실패: ' + e.message, 'error');
    }
}

async function deleteBookmark(id) {
    if (!confirm('이 북마크를 삭제하시겠습니까?')) return;
    try {
        await graphDelete(
            CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
            '/lists/' + CONFIG.bookmarksListId + '/items/' + id
        );
        showStatus('삭제 완료', 'success');
        await loadBookmarks();
    } catch (e) {
        showStatus('삭제 실패: ' + e.message, 'error');
    }
}

function editBookmark(id) {
    var item = APP.bookmarks.find(function(b) { return b.id == id; });
    if (!item) return;
    var f = item.fields;

    document.getElementById('editBookmarkId').value = id;
    document.getElementById('inputTitle').value = f.Title || '';
    document.getElementById('inputUrl').value = f.Url || '';
    document.getElementById('inputCategory').value = f.Category || '';
    document.getElementById('inputDescription').value = f.Description || '';
    document.getElementById('inputVisibility').value = f.Visibility || 'all';
    document.getElementById('inputIconUrl').value = f.IconUrl || '';
    document.getElementById('inputSortOrder').value = f.SortOrder || 0;

    document.getElementById('formTitle').textContent = '북마크 수정 (ID: ' + id + ')';
    document.getElementById('addBookmarkForm').style.display = 'block';
    document.getElementById('addBookmarkForm').scrollIntoView({ behavior: 'smooth' });
}

function cancelBookmarkEdit() {
    document.getElementById('editBookmarkId').value = '';
    document.getElementById('inputTitle').value = '';
    document.getElementById('inputUrl').value = '';
    document.getElementById('inputCategory').value = '';
    document.getElementById('inputDescription').value = '';
    document.getElementById('inputVisibility').value = 'all';
    document.getElementById('inputIconUrl').value = '';
    document.getElementById('inputSortOrder').value = '0';
    document.getElementById('formTitle').textContent = '북마크 추가';
    document.getElementById('addBookmarkForm').style.display = 'none';
}

// ─── 사용자 자동 등록 ───
async function autoRegisterUser() {
    try {
        await graphPost(
            CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/$ref',
            { '@odata.id': CONFIG.graphUrl + '/directoryObjects/' + APP.currentUserId }
        );
    } catch (e) {
        // 이미 멤버이면 무시
    }
}

// ─────────────────────────────────────────────
// 관리자 관리
// ─────────────────────────────────────────────

async function searchUser() {
    var query = document.getElementById('inputAdminSearch').value.trim();
    if (!query) { showStatus('검색어를 입력하세요.', 'error'); return; }

    try {
        var url = CONFIG.graphUrl + '/users?$filter=startswith(displayName,\'' +
                  encodeURIComponent(query) + '\') or startswith(mail,\'' +
                  encodeURIComponent(query) + '\') or startswith(userPrincipalName,\'' +
                  encodeURIComponent(query) + '\')&$top=10&$select=id,displayName,mail,userPrincipalName';
        var result = await graphGet(url);
        renderSearchResults(result.value || []);
    } catch (e) {
        // $filter 미지원 시 직접 조회
        try {
            var user = await graphGet(CONFIG.graphUrl + '/users/' + encodeURIComponent(query));
            renderSearchResults([user]);
        } catch (e2) {
            showStatus('사용자 검색 실패: ' + e.message, 'error');
            renderSearchResults([]);
        }
    }
}

function renderSearchResults(users) {
    var container = document.getElementById('searchResults');
    if (users.length === 0) {
        container.innerHTML = '<p class="search-empty">검색 결과가 없습니다.</p>';
        return;
    }
    var html = '';
    users.forEach(function(user) {
        var email = user.mail || user.userPrincipalName || '';
        html += '<div class="search-item">';
        html += '<span><strong>' + (user.displayName || '') + '</strong> (' + email + ')</span>';
        html += '<button class="btn btn-success btn-sm" onclick="addAdminById(\'' +
                user.id + '\',\'' + (user.displayName || '').replace(/'/g, "\\'") + '\')">추가</button>';
        html += '</div>';
    });
    container.innerHTML = html;
}

async function addAdminById(userId, displayName) {
    try {
        var ref = { '@odata.id': CONFIG.graphUrl + '/directoryObjects/' + userId };
        try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/$ref', ref); } catch(e) {}
        try { await graphPost(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/$ref', ref); } catch(e) {}

        showStatus(displayName + ' 관리자로 추가 완료!', 'success');
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('inputAdminSearch').value = '';
        loadAdminMembers();
    } catch (e) {
        showStatus('관리자 추가 실패: ' + e.message, 'error');
    }
}

async function loadAdminMembers() {
    try {
        var data = await graphGet(
            CONFIG.graphUrl + '/groups/' + CONFIG.groupId +
            '/members?$select=id,displayName,mail,userPrincipalName'
        );
        APP.adminMembers = data.value || [];
        renderAdminTable();
    } catch (e) {
        showStatus('관리자 목록 조회 실패: ' + e.message, 'error');
    }
}

async function removeAdmin(userId, displayName) {
    if (!confirm(displayName + ' 님을 관리자에서 제거하시겠습니까?')) return;
    if (userId === APP.currentUserId) { showStatus('자기 자신은 제거할 수 없습니다.', 'error'); return; }

    try {
        try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members/' + userId + '/$ref'); } catch(e) {}
        try { await graphDelete(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/owners/' + userId + '/$ref'); } catch(e) {}

        showStatus(displayName + ' 관리자에서 제거 완료', 'success');

        // 해당 관리자가 등록한 북마크 삭제 확인
        await deleteBookmarksByOwner(userId, displayName);
        loadAdminMembers();
    } catch (e) {
        showStatus('관리자 제거 실패: ' + e.message, 'error');
    }
}

async function deleteBookmarksByOwner(userId, displayName) {
    var member = APP.adminMembers.find(function(m) { return m.id === userId; });
    if (!member) return;
    var ownerEmail = (member.mail || member.userPrincipalName || '').toLowerCase();
    if (!ownerEmail) return;

    var matching = APP.bookmarks.filter(function(b) {
        return b.fields.Owner && b.fields.Owner.toLowerCase() === ownerEmail;
    });
    if (matching.length === 0) return;
    if (!confirm(displayName + ' 님이 등록한 북마크 ' + matching.length + '개도 삭제하시겠습니까?')) return;

    for (var i = 0; i < matching.length; i++) {
        await graphDelete(
            CONFIG.graphUrl + '/sites/' + CONFIG.siteId +
            '/lists/' + CONFIG.bookmarksListId + '/items/' + matching[i].id
        );
    }
    showStatus(matching.length + '개 북마크 삭제 완료', 'success');
    await loadBookmarks();
}

function renderAdminTable() {
    var tbody = document.getElementById('adminTableBody');
    if (APP.adminMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="table-empty">관리자가 없습니다.</td></tr>';
        return;
    }
    var html = '';
    APP.adminMembers.forEach(function(m) {
        var email = m.mail || m.userPrincipalName || '';
        var isSelf = (m.id === APP.currentUserId);
        html += '<tr><td>' + (m.displayName || '') + '</td><td>' + email + '</td><td>';
        if (isSelf) {
            html += '<span class="text-muted">본인</span>';
        } else {
            html += '<button class="btn btn-danger btn-xs" onclick="removeAdmin(\'' +
                    m.id + '\',\'' + (m.displayName || '').replace(/'/g, "\\'") + '\')">제거</button>';
        }
        html += '</td></tr>';
    });
    tbody.innerHTML = html;
}

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

function showStatus(msg, type) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status show ' + (type || 'info');
    if (type !== 'info') {
        setTimeout(function() { el.className = 'status'; }, 4000);
    }
}
