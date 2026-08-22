/**
 * Microsoft Graph API 클라이언트
 */
import { getValidToken } from '../auth/token-helper.js';
import { handleApiError } from '../utils/error-handler.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Graph API GET 요청
 */
export async function graphGet(endpoint, params = {}) {
  const token = await getValidToken();

  let url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  // 쿼리 파라미터 추가
  const query = new URLSearchParams(params).toString();
  if (query) url += (url.includes('?') ? '&' : '?') + query;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ConsistencyLevel': 'eventual'
    }
  });

  if (!response.ok) {
    await handleApiError(response, 'GET', endpoint);
  }

  return response.json();
}

/**
 * Graph API POST 요청
 */
export async function graphPost(endpoint, body) {
  const token = await getValidToken();
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    await handleApiError(response, 'POST', endpoint);
  }

  // 204 No Content 처리
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Graph API PATCH 요청
 */
export async function graphPatch(endpoint, body) {
  const token = await getValidToken();
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    await handleApiError(response, 'PATCH', endpoint);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Graph API DELETE 요청
 */
export async function graphDelete(endpoint) {
  const token = await getValidToken();
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    await handleApiError(response, 'DELETE', endpoint);
  }

  return null;
}
