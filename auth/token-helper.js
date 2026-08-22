/**
 * 토큰 관리 유틸리티
 */
import { acquireToken } from './msal-instance.js';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * 유효한 토큰 반환 (캐시 활용)
 */
export async function getValidToken() {
  const now = Date.now();

  // 만료 5분 전에 갱신
  if (cachedToken && tokenExpiry - now > 5 * 60 * 1000) {
    return cachedToken;
  }

  cachedToken = await acquireToken();
  // 토큰 디코딩하여 만료 시간 추출
  tokenExpiry = getTokenExpiry(cachedToken);
  return cachedToken;
}

/**
 * 토큰에서 만료 시간 추출
 */
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // seconds → ms
  } catch (e) {
    // 디코딩 실패 시 1시간 후 만료로 가정
    return Date.now() + 60 * 60 * 1000;
  }
}

/**
 * 토큰 캐시 초기화
 */
export function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
}
