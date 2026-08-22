/**
 * Microsoft Graph API 클라이언트
 */
import { getValidToken } from '../auth/token-helper.js';
import { handleApiError } from '../utils/error-handler.js';
import { appConfig } from '../config/app-config.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// ===== 앱 전용 토큰 캐시 =====
let appTokenCache = { token: null, expiresAt: 0 };

/**
 * Client Credentials 방식으로 앱 전용 토큰 발급
 * - Application 권한(Sites.ReadWrite.All)으로 항목 수준 권한 우회
 * - 관리자가 타인의 SharePoint 항목을 삭제할 때 사용
 */
async function getAppOnlyToken() {
  // 캐시된 토큰이 유효하면 재사용 (만료 1분 전 갱신)
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt - 60000) {
    return appTokenCache.token;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${appConfig.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: appConfig.clientId,
    client_secret: appConfig.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`App token acquisition failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };

  return appTokenCache.token;
}

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
 * Graph API DELETE 요청 (사용자 Delegated 토큰)
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

/**
 * Graph API DELETE 요청 (앱 전용 토큰 - Application 권한)
 * - 관리자가 타인의 SharePoint 항목을 삭제할 때 사용
 * - Application 권한(Sites.ReadWrite.All)으로 항목 수준 권한 우회
 */
export async function graphDeleteAsApp(endpoint) {
  const token = await getAppOnlyToken();
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    await handleApiError(response, 'DELETE(App)', endpoint);
  }

  return null;
}
