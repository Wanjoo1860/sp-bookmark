/**
 * crud.js — SharePoint 목록 CRUD (북마크)
 * 의존성: config.js, graph.js
 *
 * SharePoint 목록 "TestData" 필드:
 *   Title (텍스트) — 북마크 이름
 *   Url (텍스트) — URL
 *   Description (텍스트) — 설명
 *   Visibility (텍스트) — public | admin | private
 *   Owner (텍스트) — 소유자 이메일
 *   Ord (숫자) — 정렬 순서
 */
var Crud = (function() {
  'use strict';

  var _siteId = null;
  var _listId = null;

  /**
   * 사이트 ID 가져오기 (캐싱)
   */
  async function getSiteId() {
    if (_siteId) return _siteId;
    var result = await Graph.get(
      '/sites/' + CONFIG.siteHostname + ':' + CONFIG.sitePath
    );
    _siteId = result.id;
    return _siteId;
  }

  /**
   * 목록 ID 가져오기 (캐싱)
   */
  async function getListId() {
    if (_listId) return _listId;
    var siteId = await getSiteId();
    var result = await Graph.get(
      '/sites/' + siteId + '/lists/' + CONFIG.listName
    );
    _listId = result.id;
    return _listId;
  }

  /**
   * 목록 엔드포인트 기본 경로
   */
  async function getBasePath() {
    var siteId = await getSiteId();
    var listId = await getListId();
    return '/sites/' + siteId + '/lists/' + listId;
  }

  /**
   * 모든 북마크 읽기
   * @returns {Array} 북마크 배열
   */
  async function readAll() {
    var basePath = await getBasePath();
    var f = CONFIG.fields;
    var selectFields = [f.title, f.url, f.description, f.visibility, f.owner, f.ord].join(',');
    var endpoint = basePath + '/items?$expand=fields($select=' + selectFields + ')&$top=999';

    var result = await Graph.get(endpoint);
    var items = result.value || [];

    return items.map(function(item) {
      var fields = item.fields || {};
      return {
        id: item.id,
        name: fields[f.title] || '',
        url: fields[f.url] || '',
        desc: fields[f.description] || '',
        vis: fields[f.visibility] || 'public',
        owner: (fields[f.owner] || '').toLowerCase(),
        ord: fields[f.ord] || 0
      };
    }).sort(function(a, b) { return a.ord - b.ord; });
  }

  /**
   * 북마크 추가
   */
  async function create(bookmark) {
    var basePath = await getBasePath();
    var f = CONFIG.fields;
    var body = {
      fields: {}
    };
    body.fields[f.title] = bookmark.name;
    body.fields[f.url] = bookmark.url;
    body.fields[f.description] = bookmark.desc || '';
    body.fields[f.visibility] = bookmark.vis || 'public';
    body.fields[f.owner] = bookmark.owner || '';
    body.fields[f.ord] = bookmark.ord || 0;

    var result = await Graph.post(basePath + '/items', body);
    return {
      id: result.id,
      name: bookmark.name,
      url: bookmark.url,
      desc: bookmark.desc || '',
      vis: bookmark.vis || 'public',
      owner: bookmark.owner || '',
      ord: bookmark.ord || 0
    };
  }

  /**
   * 북마크 수정
   */
  async function update(itemId, updates) {
    var basePath = await getBasePath();
    var f = CONFIG.fields;
    var body = {};

    if (updates.name !== undefined) body[f.title] = updates.name;
    if (updates.url !== undefined) body[f.url] = updates.url;
    if (updates.desc !== undefined) body[f.description] = updates.desc;
    if (updates.vis !== undefined) body[f.visibility] = updates.vis;
    if (updates.owner !== undefined) body[f.owner] = updates.owner;
    if (updates.ord !== undefined) body[f.ord] = updates.ord;

    await Graph.patch(basePath + '/items/' + itemId + '/fields', body);
  }

  /**
   * 북마크 삭제
   */
  async function remove(itemId) {
    var basePath = await getBasePath();
    await Graph.del(basePath + '/items/' + itemId);
  }

  /**
   * 여러 항목의 순서(Ord) 일괄 업데이트
   */
  async function updateOrder(items) {
    var basePath = await getBasePath();
    var f = CONFIG.fields;
    var promises = items.map(function(item) {
      var body = {};
      body[f.ord] = item.ord;
      return Graph.patch(basePath + '/items/' + item.id + '/fields', body);
    });
    await Promise.all(promises);
  }

  return {
    readAll: readAll,
    create: create,
    update: update,
    remove: remove,
    updateOrder: updateOrder
  };
})();
