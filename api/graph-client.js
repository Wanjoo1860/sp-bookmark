/**
 * [api/graph-client.js]
 * Microsoft Graph API 공통 호출 래퍼
 * ─────────────────────────────────────────
 * [기능] 토큰 자동 주입, 재시도, 에러 핸들링
 */
import { getAccessToken } from '../auth/token-helper.js';

const MAX_RETRIES = 3;

export async function graphFetch(url, options = {}) {
  const token = await getAccessToken();
  if (!token) return null;

  const config = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, config);

      if (response.ok) {
        if (response.status === 204) return null;
        return await response.json();
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await delay(retryAfter * 1000);
        continue;
      }

      if (response.status === 401 && attempt === 0) {
        const newToken = await getAccessToken();
        if (newToken) {
          config.headers['Authorization'] = `Bearer ${newToken}`;
          continue;
        }
      }

      const errorBody = await response.json().catch(() => ({}));
      throw new GraphApiError(response.status, errorBody);

    } catch (error) {
      if (error instanceof GraphApiError) throw error;
      lastError = error;
      if (!navigator.onLine) throw new OfflineError();
      if (attempt < MAX_RETRIES - 1) await delay(1000 * (attempt + 1));
    }
  }

  throw lastError || new Error('Graph API 호출 실패');
}

export class GraphApiError extends Error {
  constructor(status, body) {
    super(`Graph API Error: ${status}`);
    this.name = 'GraphApiError';
    this.status = status;
    this.body = body;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('OFFLINE');
    this.name = 'OfflineError';
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
