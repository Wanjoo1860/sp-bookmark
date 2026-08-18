/**
 * [services/data-service.js]
 * 데이터 추상 계층 — 앱 ↔ SharePoint 브릿지
 * ─────────────────────────────────────────
 * [대체 대상] 기존 loadJSON(ST_BM) / saveJSON(ST_BM) 전체
 */
import * as bookmarksApi from '../api/endpoints/bookmarks.api.js';
import * as cacheService from './cache-service.js';
import { OfflineError } from '../api/graph-client.js';

let bookmarksCache = [];

/** 전체 북마크 로드 */
export async function loadBookmarks() {
  try {
    bookmarksCache = await bookmarksApi.fetchAllBookmarks();
    cacheService.saveToCache('bookmarks', bookmarksCache);
    return [...bookmarksCache];
  } catch (error) {
    if (error instanceof OfflineError || !navigator.onLine) {
      bookmarksCache = cacheService.loadFromCache('bookmarks') || [];
      return [...bookmarksCache];
    }
    throw error;
  }
}

/** 북마크 추가 */
export async function addBookmark(data) {
  const created = await bookmarksApi.createBookmark(data);
  bookmarksCache.push(created);
  cacheService.saveToCache('bookmarks', bookmarksCache);
  return created;
}

/** 북마크 수정 */
export async function updateBookmark(spId, changes) {
  await bookmarksApi.updateBookmark(spId, changes);
  const idx = bookmarksCache.findIndex(b => b.spId == spId);
  if (idx !== -1) {
    Object.assign(bookmarksCache[idx], changes);
    // 필드 매핑 보정
    if ('name' in changes) bookmarksCache[idx].name = changes.name;
    if ('url' in changes) bookmarksCache[idx].url = changes.url;
    if ('desc' in changes) bookmarksCache[idx].desc = changes.desc;
    if ('vis' in changes) bookmarksCache[idx].vis = changes.vis;
    if ('ord' in changes) bookmarksCache[idx].ord = changes.ord;
  }
  cacheService.saveToCache('bookmarks', bookmarksCache);
}

/** 북마크 삭제 */
export async function removeBookmark(spId) {
  await bookmarksApi.deleteBookmark(spId);
  bookmarksCache = bookmarksCache.filter(b => b.spId != spId);
  cacheService.saveToCache('bookmarks', bookmarksCache);
}

/** 사용자의 private 북마크 전부 삭제 */
export async function removePrivateBookmarksByOwner(ownerEmail) {
  const count = await bookmarksApi.deletePrivateBookmarksByOwner(ownerEmail);
  bookmarksCache = bookmarksCache.filter(b => !(b.vis === 'private' && b.owner === ownerEmail));
  cacheService.saveToCache('bookmarks', bookmarksCache);
  return count;
}

/** 정렬 변경 */
export async function reorderBookmarks(reorderedItems) {
  await bookmarksApi.batchUpdateOrder(reorderedItems);
  reorderedItems.forEach(({ spId, ord }) => {
    const bm = bookmarksCache.find(b => b.spId == spId);
    if (bm) bm.ord = ord;
  });
  cacheService.saveToCache('bookmarks', bookmarksCache);
}

/** 메모리 캐시 반환 */
export function getBookmarks() {
  return [...bookmarksCache];
}

/** 메모리 캐시 직접 갱신 (로컬 제거용) */
export function removeFromLocalCache(spId) {
  bookmarksCache = bookmarksCache.filter(b => b.spId != spId);
}
