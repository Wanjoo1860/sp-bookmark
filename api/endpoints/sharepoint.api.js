/**
 * SharePoint List CRUD API
 */
import { graphGet, graphPost, graphPatch, graphDelete } from '../graph-client.js';
import { sharepointConfig } from '../../config/sharepoint.config.js';
import { logger } from '../../utils/logger.js';

const { bookmarksListPath } = sharepointConfig;
const { columns } = sharepointConfig.lists.bookmarks;

/**
 * 모든 북마크 조회
 */
export async function fetchAllBookmarks() {
  logger.info('SharePointAPI', 'Fetching all bookmarks');

  const endpoint = `${bookmarksListPath}/items?$expand=fields&$top=999&$orderby=fields/SortOrder asc`;
  const response = await graphGet(endpoint);

  return response.value.map(item => mapToBookmark(item));
}

/**
 * 특정 사용자의 북마크 조회
 */
export async function fetchBookmarksByOwner(ownerEmail) {
  logger.info('SharePointAPI', `Fetching bookmarks for: ${ownerEmail}`);

  const endpoint = `${bookmarksListPath}/items?$expand=fields&$filter=fields/Owner eq '${ownerEmail}'&$orderby=fields/SortOrder asc`;
  const response = await graphGet(endpoint);

  return response.value.map(item => mapToBookmark(item));
}

/**
 * 북마크 생성
 */
export async function createBookmark(bookmark) {
  logger.info('SharePointAPI', 'Creating bookmark:', bookmark.title);

  const endpoint = `${bookmarksListPath}/items`;
  const body = {
    fields: {
      [columns.title]: bookmark.title,
      [columns.url]: bookmark.url,
      [columns.description]: bookmark.description || '',
      [columns.visibility]: bookmark.visibility,
      [columns.owner]: bookmark.owner,
      [columns.sortOrder]: bookmark.sortOrder || 0
    }
  };

  const response = await graphPost(endpoint, body);
  return mapToBookmark(response);
}

/**
 * 북마크 수정
 */
export async function updateBookmark(itemId, updates) {
  logger.info('SharePointAPI', `Updating bookmark: ${itemId}`);

  const endpoint = `${bookmarksListPath}/items/${itemId}/fields`;
  const fields = {};

  if (updates.title !== undefined) fields[columns.title] = updates.title;
  if (updates.url !== undefined) fields[columns.url] = updates.url;
  if (updates.description !== undefined) fields[columns.description] = updates.description;
  if (updates.visibility !== undefined) fields[columns.visibility] = updates.visibility;
  if (updates.owner !== undefined) fields[columns.owner] = updates.owner;
  if (updates.sortOrder !== undefined) fields[columns.sortOrder] = updates.sortOrder;

  const response = await graphPatch(endpoint, fields);
  return response;
}

/**
 * 북마크 삭제
 */
export async function deleteBookmark(itemId) {
  logger.info('SharePointAPI', `Deleting bookmark: ${itemId}`);

  const endpoint = `${bookmarksListPath}/items/${itemId}`;
  await graphDelete(endpoint);
}

/**
 * 특정 사용자의 개인 북마크 일괄 삭제
 */
export async function deleteBookmarksByOwner(ownerEmail) {
  logger.info('SharePointAPI', `Deleting all private bookmarks for: ${ownerEmail}`);

  const bookmarks = await fetchBookmarksByOwner(ownerEmail);
  const privateBookmarks = bookmarks.filter(b => b.visibility === 'private');

  const results = [];
  for (const bm of privateBookmarks) {
    try {
      await deleteBookmark(bm.id);
      results.push({ id: bm.id, success: true });
    } catch (error) {
      logger.error('SharePointAPI', `Failed to delete bookmark ${bm.id}:`, error);
      results.push({ id: bm.id, success: false, error });
    }
  }

  return results;
}

/**
 * 북마크 정렬 순서 일괄 업데이트
 */
export async function updateBookmarkOrders(orderUpdates) {
  logger.info('SharePointAPI', `Updating sort order for ${orderUpdates.length} items`);

  const results = [];
  for (const { itemId, sortOrder } of orderUpdates) {
    try {
      await updateBookmark(itemId, { sortOrder });
      results.push({ itemId, success: true });
    } catch (error) {
      logger.error('SharePointAPI', `Failed to update order for ${itemId}:`, error);
      results.push({ itemId, success: false, error });
    }
  }

  return results;
}

/**
 * SharePoint 아이템 → 앱 북마크 객체 매핑
 */
function mapToBookmark(item) {
  const fields = item.fields || item;
  return {
    id: item.id || fields.id,
    title: fields[columns.title] || '',
    url: fields[columns.url] || '',
    description: fields[columns.description] || '',
    visibility: fields[columns.visibility] || 'public',
    owner: fields[columns.owner] || '',
    sortOrder: fields[columns.sortOrder] || 0
  };
}
