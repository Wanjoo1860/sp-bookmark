/**
 * 멤버 관리 모달 (탭 2 — Admin 전용)
 */
import { fetchTeamOwners, fetchTeamMembers, fetchTeamGuests, searchOrganizationUsers, promoteToAdmin, demoteFromAdmin, removeTeamMember } from '../api/endpoints/members.api.js';
import { inviteGuest, removeGuestFromTeam, validateGuestEmail } from '../api/endpoints/guests.api.js';
import { removeUserBookmarks } from '../services/data-service.js';
import { getAuthState } from '../auth/auth-guard.js'; 
import { showToast } from './toast.js';
import { logger } from '../utils/logger.js';

const root = document.getElementById('memberManagementRoot');

let owners = [];
let members = [];
let guests = [];
let searchDebounce = null;

/**
 * 멤버 관리 초기화
 */
export async function initMemberManagement() {
  root.innerHTML = '<div class="loading-inline"><div class="loading-spinner-sm"></div> 로딩 중...</div>';

  try {
    [owners, members, guests] = await Promise.all([
      fetchTeamOwners(),
      fetchTeamMembers(),
      fetchTeamGuests()
    ]);

    // ✅ 추가: members에서 owners와 중복되는 사용자 제거
    const ownerIds = new Set(owners.map(o => o.id));
    members = members.filter(m => !ownerIds.has(m.id));

    render();
  } catch (error) {
    logger.error('MemberMgmt', 'Init failed:', error);
    root.innerHTML = '<p class="error-text">멤버 정보를 불러오는데 실패했습니다.</p>';
  }
}

/**
 * 전체 렌더링
 */
function render() {
  root.innerHTML = '';

  // 검색 섹션
  root.appendChild(createSearchSection());

  // 소유자 섹션
  root.appendChild(createMemberSection('소유자 (Admin)', owners, 'owner'));

  // 멤버 섹션
  root.appendChild(createMemberSection('멤버 (Member)', members, 'member'));

  // 게스트 섹션
  root.appendChild(createGuestSection());
}

/**
 * 검색 섹션 생성
 */
function createSearchSection() {
  const section = document.createElement('div');
  section.className = 'member-search-section';
  section.innerHTML = `
    <h4 class="form-title">관리자/멤버 추가</h4>
    <div class="add-row">
      <input type="text" id="memberSearchInput" placeholder="이름 또는 이메일로 직원 검색..." autocomplete="off">
    </div>
    <div id="memberSearchResults" class="search-results"></div>
  `;

  const input = section.querySelector('#memberSearchInput');
  const resultsDiv = section.querySelector('#memberSearchResults');

  input.addEventListener('input', function () {
    clearTimeout(searchDebounce);
    const query = input.value.trim();

    if (query.length < 2) {
      resultsDiv.innerHTML = '';
      return;
    }

    searchDebounce = setTimeout(async () => {
      resultsDiv.innerHTML = '<div class="search-loading">검색 중...</div>';
      try {
        const results = await searchOrganizationUsers(query);
        renderSearchResults(resultsDiv, results);
      } catch (error) {
        resultsDiv.innerHTML = '<div class="search-error">검색 실패</div>';
      }
    }, 400);
  });

  return section;
}

/**
 * 검색 결과 렌더링
 */
function renderSearchResults(container, results) {
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<div class="search-empty">검색 결과가 없습니다.</div>';
    return;
  }

  results.forEach(user => {
    // 이미 팀에 있는지 확인
    const isOwner = owners.some(o => o.id === user.id);
    const isMember = members.some(m => m.id === user.id);
    const isGuest = guests.some(g => g.id === user.id);

    const item = document.createElement('div');
    item.className = 'search-result-item';

    let statusBadge = '';
    if (isOwner) statusBadge = '<span class="status-badge badge-owner">소유자</span>';
    else if (isMember) statusBadge = '<span class="status-badge badge-member">멤버</span>';
    else if (isGuest) statusBadge = '<span class="status-badge badge-guest">게스트</span>';

    item.innerHTML = `
      <div class="search-user-info">
        <div class="search-user-avatar">${(user.displayName || '?').charAt(0).toUpperCase()}</div>
        <div class="search-user-detail">
          <div class="search-user-name">${escHtml(user.displayName)} ${statusBadge}</div>
          <div class="search-user-email">${escHtml(user.email)}${user.department ? ' · ' + escHtml(user.department) : ''}</div>
        </div>
      </div>
      <div class="search-user-actions">
        ${!isOwner && !isGuest ? `<button class="btn-action btn-promote" data-id="${user.id}" data-name="${escHtml(user.displayName)}">관리자로 추가</button>` : ''}
        ${!isMember && !isOwner && !isGuest ? `<button class="btn-action btn-add-member" data-id="${user.id}" data-name="${escHtml(user.displayName)}">멤버로 추가</button>` : ''}
      </div>
    `;

    // 관리자로 추가 버튼
    const promoteBtn = item.querySelector('.btn-promote');
    if (promoteBtn) {
      promoteBtn.addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 관리자로 추가하시겠습니까?`)) return;
        try {
          promoteBtn.disabled = true;
          promoteBtn.textContent = '추가 중...';
          await promoteToAdmin(user.id);
          showToast(`"${user.displayName}" 관리자로 추가 완료`, 'success');

          // 낙관적 UI 업데이트
          members = members.filter(m => m.id !== user.id);
          owners.push({ id: user.id, displayName: user.displayName, email: user.email, userType: 'Member' });
          render();

          setTimeout(async () => {
            await initMemberManagement();
          }, 3000);
        } catch (error) {
          showToast('관리자 추가 실패: ' + error.message, 'error');
        }
      });
    }

    // 멤버로 추가 버튼
    const addMemberBtn = item.querySelector('.btn-add-member');
    if (addMemberBtn) {
      addMemberBtn.addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 멤버로 추가하시겠습니까?`)) return;
        try {
          addMemberBtn.disabled = true;
          addMemberBtn.textContent = '추가 중...';
          const { addTeamMember } = await import('../api/endpoints/members.api.js');
          await addTeamMember(user.id);
          showToast(`"${user.displayName}" 멤버로 추가 완료`, 'success');

          // 낙관적 UI 업데이트
          members.push({ id: user.id, displayName: user.displayName, email: user.email, userType: 'Member' });
          render();

          setTimeout(async () => {
            await initMemberManagement();
          }, 3000);
        } catch (error) {
          showToast('멤버 추가 실패: ' + error.message, 'error');
        }
      });
    }

    container.appendChild(item);
  });
}

/**
 * 멤버 섹션 생성 (Owner / Member)
 */
function createMemberSection(title, list, type) {
  const section = document.createElement('div');
  section.className = 'member-section';

  const header = document.createElement('div');
  header.className = `member-section-header section-${type}`;
  header.innerHTML = `<span class="member-section-dot"></span> ${title} <span class="member-count">${list.length}명</span>`;
  section.appendChild(header);

  const listEl = document.createElement('div');
  listEl.className = 'member-list';

  if (list.length === 0) {
    listEl.innerHTML = '<div class="bm-empty">등록된 사용자가 없습니다.</div>';
  }

  list.forEach(user => {
    const item = document.createElement('div');
    item.className = 'member-item';

    const initial = (user.displayName || '?').charAt(0).toUpperCase();
    const roleClass = type === 'owner' ? 'role-admin' : 'role-user';

    item.innerHTML = `
      <div class="user-avatar ${roleClass}">${initial}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(user.displayName)}</div>
        <div class="user-info-role">${escHtml(user.email)}</div>
      </div>
      <div class="user-actions"></div>
    `;

    const actions = item.querySelector('.user-actions');

        if (type === 'owner') {
      const currentState = getAuthState();
      const isSelf = (user.email || user.mail || user.userPrincipalName || '').toLowerCase() === currentState.email?.toLowerCase();

      if (isSelf) {
        const selfLabel = document.createElement('span');
        selfLabel.className = 'self-label';
        selfLabel.textContent = '(본인)';
        selfLabel.style.cssText = 'color: var(--text-muted); font-size: 12px; padding: 4px 8px;';
        actions.appendChild(selfLabel);
      } else {
        const demoteBtn = document.createElement('button');
        demoteBtn.className = 'btn-user-role';
        demoteBtn.textContent = '→ 멤버로 강등';
        demoteBtn.addEventListener('click', async () => {
          if (!confirm(`"${user.displayName}"을(를) 멤버로 강등하시겠습니까?`)) return;
          try {
            demoteBtn.disabled = true;
            demoteBtn.textContent = '강등 중...';
            await demoteFromAdmin(user.id);
            showToast(`"${user.displayName}" 멤버로 강등 완료`, 'success');

            // 낙관적 UI 업데이트: 로컬 배열 즉시 수정
            owners = owners.filter(o => o.id !== user.id);
            members.push(user);
            render();

            // 백그라운드에서 서버 데이터 동기화
            setTimeout(async () => {
              await initMemberManagement();
            }, 3000);
          } catch (error) {
            showToast('강등 실패: ' + error.message, 'error');
            demoteBtn.disabled = false;
            demoteBtn.textContent = '→ 멤버로 강등';
          }
        });
        actions.appendChild(demoteBtn);
      }
    }

    if (type === 'member') {
      // 멤버 → 관리자 승격
      const promoteBtn = document.createElement('button');
      promoteBtn.className = 'btn-user-role';
      promoteBtn.textContent = '→ 관리자로 승격';
      promoteBtn.addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 관리자로 승격하시겠습니까?`)) return;
        try {
          promoteBtn.disabled = true;
          promoteBtn.textContent = '승격 중...';
          await promoteToAdmin(user.id);
          showToast(`"${user.displayName}" 관리자로 승격 완료`, 'success');

          // 낙관적 UI 업데이트: 로컬 배열 즉시 수정
          members = members.filter(m => m.id !== user.id);
          owners.push(user);
          render();

          // 백그라운드에서 서버 데이터 동기화
          setTimeout(async () => {
            await initMemberManagement();
          }, 3000);
        } catch (error) {
          showToast('승격 실패: ' + error.message, 'error');
          promoteBtn.disabled = false;
          promoteBtn.textContent = '→ 관리자로 승격';
        }
      });

      actions.appendChild(promoteBtn);

      // 멤버 개인 북마크 삭제
            // 멤버 삭제 (팀에서 제외 + 개인 북마크 삭제)
      const delMemberBtn = document.createElement('button');
      delMemberBtn.className = 'btn-user-del';
      delMemberBtn.textContent = '삭제';
      delMemberBtn.title = '팀에서 제외 및 개인 즐겨찾기 삭제';
      delMemberBtn.addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 삭제하시겠습니까?\n\n· Teams 팀 멤버에서 제외\n· 등록된 개인 즐겨찾기 삭제`)) return;
        try {
          delMemberBtn.disabled = true;
          delMemberBtn.textContent = '삭제 중...';
          await removeTeamMember(user.id);
          await removeUserBookmarks(user.email);
          showToast(`"${user.displayName}" 삭제 완료 (팀 제외 + 즐겨찾기 삭제)`, 'success');

          // 낙관적 UI 업데이트
          members = members.filter(m => m.id !== user.id);
          render();

          // 백그라운드 동기화
          setTimeout(async () => {
            await initMemberManagement();
          }, 3000);
        } catch (error) {
          showToast('삭제 실패: ' + error.message, 'error');
          delMemberBtn.disabled = false;
          delMemberBtn.textContent = '삭제';
        }
      });
      actions.appendChild(delMemberBtn);
    }

    listEl.appendChild(item);
  });

  section.appendChild(listEl);
  return section;
}

/**
 * 게스트 섹션 생성
 */
function createGuestSection() {
  const section = document.createElement('div');
  section.className = 'member-section';

  const header = document.createElement('div');
  header.className = 'member-section-header section-guest';
  header.innerHTML = `<span class="member-section-dot"></span> 게스트 (Guest) <span class="member-count">${guests.length}명</span>`;
  section.appendChild(header);

  // Guest 초대 폼
  const inviteForm = document.createElement('div');
  inviteForm.className = 'guest-invite-form';
  inviteForm.innerHTML = `
    <div class="add-row">
      <input type="email" id="guestEmailInput" placeholder="외부 이메일 주소 (예: user@gmail.com)" autocomplete="off">
      <button id="btnInviteGuest" class="btn-add">초대</button>
    </div>
    <p id="guestInviteHint" class="input-hint"></p>
  `;

  const emailInput = inviteForm.querySelector('#guestEmailInput');
  const inviteBtn = inviteForm.querySelector('#btnInviteGuest');
  const hint = inviteForm.querySelector('#guestInviteHint');

  inviteBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) { showToast('이메일을 입력하세요'); return; }

    const validation = validateGuestEmail(email);
    if (!validation.valid) {
      hint.textContent = validation.message;
      hint.style.color = 'var(--danger)';
      return;
    }

    if (!confirm(`"${email}"을(를) Guest로 초대하시겠습니까?`)) return;

    try {
      inviteBtn.disabled = true;
      inviteBtn.textContent = '초대 중...';
      emailInput.value = '';
      hint.textContent = '';
      const result = await inviteGuest(email);
      showToast(`"${email}" 초대 완료. 초대 메일이 발송되었습니다. (스팸 폴더도 확인해 주세요)`, 'success');
      await new Promise(resolve => setTimeout(resolve, 1500));
      await initMemberManagement();

    } catch (error) {
      showToast('초대 실패: ' + error.message, 'error');
    } finally {
      inviteBtn.disabled = false;
      inviteBtn.textContent = '초대';
    }
  });

  section.appendChild(inviteForm);

  // Guest 목록
  const listEl = document.createElement('div');
  listEl.className = 'member-list';

  if (guests.length === 0) {
    listEl.innerHTML = '<div class="bm-empty">등록된 게스트가 없습니다.</div>';
  }

  guests.forEach(user => {
    const item = document.createElement('div');
    item.className = 'member-item';

    const initial = (user.displayName || '?').charAt(0).toUpperCase();

    item.innerHTML = `
      <div class="user-avatar role-guest">${initial}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(user.displayName)}</div>
        <div class="user-info-role">${escHtml(user.email)}</div>
      </div>
      <div class="user-actions"></div>
    `;

    const actions = item.querySelector('.user-actions');

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-user-del';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 삭제하시겠습니까?\n\n· Guest 계정 삭제\n· 등록된 개인 즐겨찾기 삭제`)) return;
        try {
          delBtn.disabled = true;
          delBtn.textContent = '삭제 중...';
          await removeGuestFromTeam(user.id);
          await removeUserBookmarks(user.email);
          showToast(`"${user.displayName}" 삭제 완료 (계정 삭제 + 즐겨찾기 삭제)`, 'success');
          await new Promise(resolve => setTimeout(resolve, 1500));
          await initMemberManagement();
        } catch (error) {
          showToast('삭제 실패: ' + error.message, 'error');
          delBtn.disabled = false;
          delBtn.textContent = '삭제';
        }
      });

    actions.appendChild(delBtn);

    listEl.appendChild(item);
  });

  section.appendChild(listEl);
  return section;
}

/* ─── 유틸 ─── */
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
