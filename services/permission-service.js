/**
 * 권한 서비스 — UI/데이터 접근 제어
 */
import { getAuthState, hasPermission } from '../auth/auth-guard.js';
import { roleConfig } from '../config/role.config.js';

/**
 * 북마크 읽기 가능 여부
 */
export function canReadBookmark(bookmark) {
  const state = getAuthState();
  if (!state.isAuthenticated || state.role === 'none') return false;

  // 공개 북마크 — 모든 인증 사용자 읽기 가능
  if (bookmark.visibility === 'public') return true;

  // 관리자 전용 — admin만
  if (bookmark.visibility === 'admin') return state.role === 'admin';

  // 개인 — 본인 또는 admin
  if (bookmark.visibility === 'private') {
    return state.role === 'admin' || bookmark.owner?.toLowerCase() === state.email?.toLowerCase();
  }

  return false;
}

/**
 * 북마크 생성 가능 여부
 */
export function canCreateBookmark() {
  const state = getAuthState();
  if (!state.isAuthenticated || state.role === 'none') return false;
  return hasPermission('create') || hasPermission('create-own');
}

/**
 * 북마크 수정 가능 여부
 */
export function canUpdateBookmark(bookmark) {
  const state = getAuthState();
  if (!state.isAuthenticated) return false;

  // admin은 모든 북마크 수정 가능
  if (hasPermission('update-all')) return true;

  // member/guest는 본인 소유 개인 북마크만
  if (hasPermission('update-own')) {
    return bookmark.visibility === 'private' &&
           bookmark.owner?.toLowerCase() === state.email?.toLowerCase();
  }

  return false;
}

/**
 * 북마크 삭제 가능 여부
 */
export function canDeleteBookmark(bookmark) {
  const state = getAuthState();
  if (!state.isAuthenticated) return false;

  if (hasPermission('delete-all')) return true;

  if (hasPermission('delete-own')) {
    return bookmark.visibility === 'private' &&
           bookmark.owner?.toLowerCase() === state.email?.toLowerCase();
  }

  return false;
}

/**
 * Visibility 변경 가능 여부
 */
export function canChangeVisibility() {
  return hasPermission('manage-visibility');
}

/**
 * 멤버 관리 가능 여부
 */
export function canManageMembers() {
  return hasPermission('manage-members');
}

/**
 * Guest 관리 가능 여부
 */
export function canManageGuests() {
  return hasPermission('manage-guests');
}

/**
 * 사용 내역 조회 가능 여부
 */
export function canViewUsage() {
  return hasPermission('view-usage');
}

/**
 * 사용자 북마크 삭제 가능 여부
 */
export function canDeleteUserBookmarks() {
  return hasPermission('delete-user-bookmarks');
}

/**
 * Visibility 옵션 목록 반환 (역할에 따라)
 */
export function getVisibilityOptions() {
  const state = getAuthState();

  if (state.role === 'admin') {
    return [
      { value: 'public', label: '공개' },
      { value: 'admin', label: '관리자 전용' },
      { value: 'private', label: '개인' }
    ];
  }

  // member, guest는 개인만
  return [
    { value: 'private', label: '개인' }
  ];
}
