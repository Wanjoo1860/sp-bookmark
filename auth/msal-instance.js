/**
 * [auth/msal-instance.js]
 * MSAL PublicClientApplication 초기화
 * ─────────────────────────────────────────
 * [대체 대상] 기존 doLogin(), setSession() 인증 초기화 부분
 * [참고] msal-browser는 CDN으로 로드되어 window.msal 전역 사용
 */
import { msalConfig } from '../config/auth.config.js';

let msalInstance = null;

export function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new msal.PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

export async function initializeMsal() {
  const instance = getMsalInstance();
  const response = await instance.handleRedirectPromise();
  if (response) {
    instance.setActiveAccount(response.account);
  }
  return instance;
}
