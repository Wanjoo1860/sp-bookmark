/**
 * [ui/user-modal.js]
 * 멤버 관리 UI (관리자/사용자/Guest 분류)
 * ─────────────────────────────────────────
 * [대체 대상] 기존 renderUserList(), btnAddUser 이벤트
 * [역할 규칙]
 *   관리자(Owner): 멤버 수정/삭제, 관리자 등록/삭제 가능
 *   사용자(Member): private 북마크 등록 시 자동 멤버, 승격/삭제 가능
 *   Guest: 앱 접근 가능, 관리자 승격 불가, 삭제 가능
 */
import { $ } from '../utils/dom-helpers.js';
import { escHtml } from '../utils/dom-helpers.js';
import { toast } from './toast.js';
import * as userService from '../services/user-service.js';

const userSearchInput = $('#userSearchInput');
const btnSearchUser = $('#btnSearchUser');
const userSearchResults = $('#userSearchResults');
const adminList = $('#adminList');
const userList = $('#userList');
const guestList = $('#guestList');
const adminCount = $('#adminCount');
const userCount = $('#userCount');
const guestCount = $('#guestCount');
const userSearchForm = $('#userSearchForm');

let currentUser = null;
let onDataChanged = null;

export function initUserModal(options) {
  currentUser = options.currentUser;
  onDataChanged = options.onDataChanged;

  btnSearchUser.addEventListener('click', handleSearch);
  userSearchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleSearch();
  });
}

export function setCurrentUser(user) {
  currentUser = user;
}

export async function renderMemberList() {
  if (currentUser.role !== 'admin') {
    userSearchForm.style.display = 'none';
    return;
  }
  userSearchForm.style.display = '';

  try {
    const { admins, users, guests } = await userService.loadAllMembers();

    adminCount.textContent = admins.length + '명';
    userCount.textContent = users.length + '명';
    guestCount.textContent = guests.length + '명';

    renderAdminList(admins);
    renderUserList(users);
    renderGuestList(guests);
  } catch (e) {
    toast('멤버 목록 로드 실패');
    console.error(e);
  }
}

// ─── 검색 ─── //

async function handleSearch() {
  const query = userSearchInput.value.trim();
  if (!query) { toast('검색어를 입력하세요'); return; }

  userSearchResults.innerHTML = '<div class="bm-empty">검색 중...</div>';

  try {
    const results = await userService.searchUsers(query);
    if (results.length === 0) {
      userSearchResults.innerHTML = '<div class="bm-empty">검색 결과가 없습니다.</div>';
      return;
    }

    userSearchResults.innerHTML = '';
    results.forEach(user => {
      const item = document.createElement('div');
      item.className = 'user-item';
      item.innerHTML = `
        <div class="user-avatar role-user">${escHtml((user.displayName || '?').charAt(0).toUpperCase())}</div>
        <div class="user-info">
          <div class="user-info-id">${escHtml(user.displayName)}</div>
          <div class="user-info-role">${escHtml(user.email)} ${user.userType === 'Guest' ? '<span style="color:var(--warning)">(Guest)</span>' : ''}</div>
        </div>
        <div class="user-actions">
          <button class="btn-user-role" data-uid="${escHtml(user.id)}">멤버 추가</button>
        </div>
      `;

      item.querySelector('.btn-user-role').addEventListener('click', async () => {
        try {
          await userService.addMember(user.id);
          toast(`"${user.displayName}" 멤버 추가 완료`);
          userSearchResults.innerHTML = '';
          userSearchInput.value = '';
          await renderMemberList();
        } catch (e) {
          if (e.status === 400) {
            toast('이미 멤버로 등록되어 있습니다.');
          } else {
            toast('멤버 추가 실패');
          }
        }
      });

      userSearchResults.appendChild(item);
    });
  } catch (e) {
    userSearchResults.innerHTML = '<div class="bm-empty">검색 실패</div>';
  }
}

// ─── 관리자 목록 ─── //

function renderAdminList(admins) {
  adminList.innerHTML = '';
  admins.forEach(user => {
    const isMe = (user.id === currentUser.objectId);
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-avatar role-admin">${escHtml((user.displayName || '?').charAt(0).toUpperCase())}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(user.displayName)}${isMe ? '<span class="me-badge">(나)</span>' : ''}</div>
        <div class="user-info-role">${escHtml(user.email)}</div>
      </div>
      <div class="user-actions">
        ${!isMe ? `<button class="btn-user-del" data-uid="${escHtml(user.id)}" data-name="${escHtml(user.displayName)}">관리자 해제</button>` : ''}
      </div>
    `;

    if (!isMe) {
      item.querySelector('.btn-user-del').addEventListener('click', async () => {
        if (!confirm(`"${user.displayName}"을(를) 관리자에서 해제하시겠습니까?`)) return;
        try {
          await userService.demoteFromAdmin(user.id);
          toast(`"${user.displayName}" 관리자 해제 완료`);
          await renderMemberList();
        } catch (e) {
          toast('관리자 해제 실패');
        }
      });
    }

    adminList.appendChild(item);
  });
}

// ─── 사용자 목록 ─── //

function renderUserList(users) {
  userList.innerHTML = '';
  if (users.length === 0) {
    userList.innerHTML = '<div class="bm-empty">등록된 사용자가 없습니다.</div>';
    return;
  }

  users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-avatar role-user">${escHtml((user.displayName || '?').charAt(0).toUpperCase())}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(user.displayName)}</div>
        <div class="user-info-role">${escHtml(user.email)}</div>
      </div>
      <div class="user-actions">
        <button class="btn-user-role btn-promote" data-uid="${escHtml(user.id)}" data-name="${escHtml(user.displayName)}">→ 관리자</button>
        <button class="btn-user-del" data-uid="${escHtml(user.id)}" data-email="${escHtml(user.email)}" data-name="${escHtml(user.displayName)}">삭제</button>
      </div>
    `;

    // 관리자 승격
    item.querySelector('.btn-promote').addEventListener('click', async () => {
      if (!confirm(`"${user.displayName}"을(를) 관리자로 승격하시겠습니까?`)) return;
      try {
        await userService.promoteToAdmin(user.id);
        toast(`"${user.displayName}" 관리자 승격 완료`);
        await renderMemberList();
      } catch (e) {
        toast('관리자 승격 실패');
      }
    });

    // 삭제 (private 북마크 함께 삭제)
    item.querySelector('.btn-user-del').addEventListener('click', async () => {
      if (!confirm(`"${user.displayName}" 사용자를 삭제하시겠습니까?\n해당 사용자의 개인 즐겨찾기도 함께 삭제됩니다.\n(관리자/공용 즐겨찾기는 삭제되지 않습니다.)`)) return;
      try {
        await userService.removeMember(user.id, user.email);
        toast(`"${user.displayName}" 삭제 완료`);
        await renderMemberList();
        if (onDataChanged) onDataChanged();
      } catch (e) {
        toast('사용자 삭제 실패');
      }
    });

    userList.appendChild(item);
  });
}

// ─── Guest 목록 ─── //

function renderGuestList(guests) {
  guestList.innerHTML = '';
  if (guests.length === 0) {
    guestList.innerHTML = '<div class="bm-empty">등록된 Guest가 없습니다.</div>';
    return;
  }

  guests.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-avatar" style="background:var(--warning)">${escHtml((user.displayName || '?').charAt(0).toUpperCase())}</div>
      <div class="user-info">
        <div class="user-info-id">${escHtml(user.displayName)} <span style="font-size:10px;color:var(--warning)">(Guest)</span></div>
        <div class="user-info-role">${escHtml(user.email)}</div>
      </div>
      <div class="user-actions">
        <button class="btn-user-del" data-uid="${escHtml(user.id)}" data-email="${escHtml(user.email)}" data-name="${escHtml(user.displayName)}">삭제</button>
      </div>
    `;

    // Guest 삭제
    item.querySelector('.btn-user-del').addEventListener('click', async () => {
      if (!confirm(`"${user.displayName}" Guest를 삭제하시겠습니까?\n해당 Guest의 개인 즐겨찾기도 함께 삭제됩니다.`)) return;
      try {
        await userService.removeMember(user.id, user.email);
        toast(`"${user.displayName}" Guest 삭제 완료`);
        await renderMemberList();
        if (onDataChanged) onDataChanged();
      } catch (e) {
        toast('Guest 삭제 실패');
      }
    });

    guestList.appendChild(item);
  });
}
