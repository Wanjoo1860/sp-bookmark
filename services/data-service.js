/**
 * 데이터 서비스 — 북마크 CRUD 비즈니스 로직
 */
import {
  fetchAllBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  deleteBookmarksByOwner,
  updateBookmarkOrders
} from '../api/endpoints/sharepoint.api.js';
import { getAuthState } from '../auth/auth-guard.js';
import { canReadBookmark, canCreateBookmark, canUpdateBookmark, canDeleteBookmark } from './permission-service.js';
import { cacheService } from './cache-service.js';
import { logger } from '../utils/logger.js';

const CACHE_KEY = 'bookmarks';

/**
 * 북마크 목록 조회 (캐시 활용 + 권한 필터)
 */
export async function getBookmarks(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheService.get(CACHE_KEY);
    if (cached) {
      logger.debug('DataService', 'Returning cached bookmarks');
      return filterByPermission(cached);
    }
  }

  const bookmarks = await fetchAllBookmarks();
  cacheService.set(CACHE_KEY, bookmarks);
  return filterByPermission(bookmarks);
}

/**
 * 북마크 전체 조회 (Admin용 — 필터 없음)
 */
export async function getAllBookmarksUnfiltered(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheService.get(CACHE_KEY);
    if (cached) return cached;
  }

  const bookmarks = await fetchAllBookmarks();
  cacheService.set(CACHE_KEY, bookmarks);
  return bookmarks;
}

/**
 * 북마크 생성
 */
export async function addBookmark(data) {
  if (!canCreateBookmark()) {
    throw new Error('북마크 생성 권한이 없습니다.');
  }

  const state = getAuthState();
  const bookmark = {
    title: data.title,
    url: data.url.startsWith('http') ? data.url : 'https://' + data.url,
    description: data.description || '',
    visibility: data.visibility || 'private',
    owner: state.email,
    sortOrder: data.sortOrder || 0
  };

  const created = await createBookmark(bookmark);
  cacheService.invalidate(CACHE_KEY);
  return created;
}

/**
 * 북마크 수정
 */
export async function editBookmark(itemId, updates) {
  const bookmarks = await getAllBookmarksUnfiltered();
  const target = bookmarks.find(b => b.id === itemId);

  if (!target) throw new Error('북마크를 찾을 수 없습니다.');
  if (!canUpdateBookmark(target)) throw new Error('수정 권한이 없습니다.');

  if (updates.url && !updates.url.startsWith('http')) {
    updates.url = 'https://' + updates.url;
  }

  await updateBookmark(itemId, updates);
  cacheService.invalidate(CACHE_KEY);
}

/**
 * 북마크 삭제
 */
export async function removeBookmark(itemId) {
  if (!itemId) throw new Error('삭제할 항목의 ID가 없습니다.');

  const bookmarks = await getAllBookmarksUnfiltered();
  const target = bookmarks.find(b => String(b.id) === String(itemId));  // ✅ 타입 안전 비교

  if (!target) throw new Error('북마크를 찾을 수 없습니다.');
  if (!canDeleteBookmark(target)) throw new Error('삭제 권한이 없습니다.');

  await deleteBookmark(itemId);
  cacheService.invalidate(CACHE_KEY);
}


/**
 * 사용자의 개인 북마크 일괄 삭제
 */
export async function removeUserBookmarks(ownerEmail) {
  const results = await deleteBookmarksByOwner(ownerEmail);
  cacheService.invalidate(CACHE_KEY);
  return results;
}

/**
 * 정렬 순서 업데이트
 */
export async function reorderBookmarks(orderUpdates) {
  await updateBookmarkOrders(orderUpdates);
  cacheService.invalidate(CACHE_KEY);
}

/**
 * 사용자별 개인 북마크 통계 (Admin용)
 */
export async function getUserBookmarkStats() {
  const allBookmarks = await getAllBookmarksUnfiltered(true);
  const privateBookmarks = allBookmarks.filter(b => b.visibility === 'private');

  const stats = {};
  for (const bm of privateBookmarks) {
    const owner = bm.owner || 'unknown';
    if (!stats[owner]) {
      stats[owner] = { email: owner, count: 0, bookmarks: [] };
    }
    stats[owner].count++;
    stats[owner].bookmarks.push(bm);
  }

  return Object.values(stats);
}

/**
 * 권한에 따른 북마크 필터링
 */
function filterByPermission(bookmarks) {
  return bookmarks.filter(bm => canReadBookmark(bm));
}
