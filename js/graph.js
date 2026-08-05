/**
 * graph.js — Microsoft Graph API 호출 헬퍼
 * 의존성: config.js
 */
var Graph = (function() {
  'use strict';

  var _getToken = null; // auth.js에서 설정

  /**
   * 토큰 획득 함수를 등록 (auth.js에서 호출)
   */
  function setTokenProvider(fn) {
    _getToken = fn;
  }

  /**
   * Graph API 호출
   */
  async function call(endpoint, options) {
    if (!_getToken) throw new Error('토큰 프로바이더가 설정되지 않았습니다.');

    var token = await _getToken();
    var url = endpoint.startsWith('http') ? endpoint : CONFIG.graphUrl + endpoint;

    var defaults = {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    var opts = Object.assign({}, defaults, options || {});
    if (options && options.headers) {
      opts.headers = Object.assign({}, defaults.headers, options.headers);
    }

    var response = await fetch(url, opts);

    if (response.status === 204) return null; // No Content (DELETE 성공)
    if (!response.ok) {
      var errBody;
      try { errBody = await response.json(); } catch(e) { errBody = {}; }
      var err = new Error(errBody.error ? errBody.error.message : ('HTTP ' + response.status));
      err.status = response.status;
      err.body = errBody;
      throw err;
    }

    var text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /**
   * GET 호출
   */
  function get(endpoint) {
    return call(endpoint, { method: 'GET' });
  }

  /**
   * POST 호출
   */
  function post(endpoint, body) {
    return call(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  /**
   * PATCH 호출
   */
  function patch(endpoint, body) {
    return call(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  /**
   * DELETE 호출
   */
  function del(endpoint) {
    return call(endpoint, { method: 'DELETE' });
  }

  return {
    setTokenProvider: setTokenProvider,
    call: call,
    get: get,
    post: post,
    patch: patch,
    del: del
  };
})();
