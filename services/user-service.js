/**
 * [services/user-service.js]
 * 사용자/멤버 관리 비즈니스 로직
 * ─────────────────────────────────────────
 * [대체 대상] 기존 getUsers(), saveUsers(), renderUserList()
 * [역할 규칙]
 *   관리자: Group Owner — 멤버 수정/삭제 가능, 관리자 등록/삭제 가능
 *   사용자: Group Member (userType=Member) — private 북마크 등록 시 자동 추가됨
 *   Guest: Group Member (userType=Guest) — 관리자 승격 불가
 */
import * as membersApi from '../api/endpoints/members.api.js';
import * as dataService from './data-service.js';

/**
 * 전체 멤버 데이터 로드 (관리자/사용자/게스트 분류)
 */
export async function loadAllMembers() {
  const [owners, members] = await Promise.all([
    membersApi.fetchGroupOwners(),
    membersApi.fetchGroupMembers()
  ]);

  const ownerIds = new Set(owners.map(o => o.id));

  // 멤버에서 소유자 제외
  const nonOwnerMembers = members.filter(m => !ownerIds.has(m.id));

  const admins = owners;
  const users = nonOwnerMembers.filter(m => m.userType !== 'Guest');
  const guests = nonOwnerMembers.filter(m => m.userType === 'Guest');

  return { admins, users, guests };
}

/** 사용자 검색 */
export async function searchUsers(query) {
  return await membersApi.searchUsers(query);
}

/** 멤버로 추가 (그룹에 멤버 추가) */
export async function addMember(userId) {
  await membersApi.addMemberToGroup(userId);
}

/** 멤버 제거 + private 북마크 삭제 */
export async function removeMember(userId, userEmail) {
  // 1. private 북마크 삭제
  await dataService.removePrivateBookmarksByOwner(userEmail);
  // 2. 그룹에서 제거
  await membersApi.removeMemberFromGroup(userId);
}

/** 관리자로 승격 (Owner 추가) */
export async function promoteToAdmin(userId) {
  await membersApi.addOwnerToGroup(userId);
}

/** 관리자 해제 (Owner 제거) */
export async function demoteFromAdmin(userId) {
  await membersApi.removeOwnerFromGroup(userId);
}
