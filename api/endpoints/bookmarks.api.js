/**
 * [api/endpoints/bookmarks.api.js]
 * SharePoint List 기반 북마크 CRUD
 * ─────────────────────────────────────────
 * [대체 대상] 기존 localStorage.getItem/setItem('portal_bm_v7')
 */
import { graphFetch } from '../graph-client.js';
import { sharepointConfig, fieldMap } from '../../config/sharepoint.config.js';

const BASE = `${sharepointConfig.graphUrl}/sites/${sharepointConfig.siteId}/lists/${sharepointConfig.bookmarksListId}/items`;

/** 전체 북마크 조회 */
export async function fetchAllBookmarks() {
  let allItems = [];
  let url = `${BASE}?$expand=fields&$top=200&$orderby=fields/${fieldMap.ord} asc`;

  while (url) {
    const response = await graphFetch(url);
    const items = (response.value || []).map(spItemToBookmark);
    allItems = allItems.concat(items);
    url = response['@odata.nextLink'] || null;
  }

  return allItems;
}

/** 북마크 추가 */
export async function createBookmark(bookmark) {
  // 필수 필드 검증
  if (!bookmark.name || !bookmark.url) {
    throw new Error('[createBookmark] name과 url은 필수 값입니다.');
  }
  const body = { fields: bookmarkToSpFields(bookmark) };
  const response = await graphFetch(BASE, { method: 'POST', body });
  return spItemToBookmark(response);
}

/** 북마크 수정 */
export async function updateBookmark(spItemId, changes) {
  const url = `${BASE}/${spItemId}/fields`;
  const fields = {};
  if ('name' in changes) fields[fieldMap.name] = changes.name;
  if ('url' in changes) fields[fieldMap.url] = changes.url;
  if ('desc' in changes) fields[fieldMap.desc] = changes.desc;
  if ('vis' in changes) fields[fieldMap.vis] = changes.vis;
  if ('owner' in changes) fields[fieldMap.owner] = changes.owner;
  if ('ord' in changes) fields[fieldMap.ord] = changes.ord;
  return await graphFetch(url, { method: 'PATCH', body: fields });
}

/** 북마크 삭제 */
export async function deleteBookmark(spItemId) {
  const url = `${BASE}/${spItemId}`;
  await graphFetch(url, { method: 'DELETE' });
}

/** 일괄 순서 업데이트 */
export async function batchUpdateOrder(items) {
  const promises = items.map(item =>
    updateBookmark(item.spId, { ord: item.ord })
  );
  await Promise.all(promises);
}

/** 특정 Owner의 private 북마크 삭제 */
export async function deletePrivateBookmarksByOwner(ownerEmail) {
  const filterQuery = `fields/${fieldMap.vis} eq 'private' and fields/${fieldMap.owner} eq '${ownerEmail}'`;
  const url = `${BASE}?$expand=fields&$filter=${filterQuery}&$top=200`;
  const response = await graphFetch(url);
  const items = response.value || [];
  const delPromises = items.map(item =>
    graphFetch(`${BASE}/${item.id}`, { method: 'DELETE' })
  );
  await Promise.all(delPromises);
  return items.length;
}

// ─── 변환 유틸 ─── //

function spItemToBookmark(item) {
  const f = item.fields || {};
  return {
    id: String(item.id),
    spId: item.id,
    name: f[fieldMap.name] || '',
    url: f[fieldMap.url] || '',
    desc: f[fieldMap.desc] || '',
    vis: f[fieldMap.vis] || 'public',
    owner: f[fieldMap.owner] || '',
    ord: f[fieldMap.ord] ?? 0
  };
}

function bookmarkToSpFields(bm) {
  return {
    [fieldMap.name]: bm.name,
    [fieldMap.url]: bm.url,
    [fieldMap.desc]: bm.desc || '',
    [fieldMap.vis]: bm.vis || 'public',
    [fieldMap.owner]: bm.owner || '',
    [fieldMap.ord]: bm.ord ?? 0
  };
}
