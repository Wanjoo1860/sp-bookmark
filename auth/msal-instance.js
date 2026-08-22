/**
 * MSAL 인스턴스 초기화 및 관리
 */
import { msalConfig, loginRequest, tokenRequest } from '../config/auth.config.js';

let msalInstance = null;
let currentAccount = null;

/**
 * MSAL 초기화
 */
export async function initializeMsal() {
  msalInstance = new msal.PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  // 리디렉트 응답 처리
  const response = await msalInstance.handleRedirectPromise();
  if (response) {
    currentAccount = response.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
    }
  }

  return currentAccount;
}

/**
 * 팝업 로그인
 */
export async function login() {
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    currentAccount = response.account;
    return currentAccount;
  } catch (error) {
    if (error.errorCode === 'popup_window_error' || error.errorCode === 'empty_window_error') {
      // 팝업 차단 시 리디렉트로 폴백
      await msalInstance.loginRedirect(loginRequest);
    }
    throw error;
  }
}

/**
 * 로그아웃
 */
export async function logout() {
  await msalInstance.logoutPopup({
    account: currentAccount,
    postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
  });
  currentAccount = null;
}

/**
 * 액세스 토큰 획득 (Silent → Popup 폴백)
 */
export async function acquireToken() {
  if (!currentAccount) {
    throw new Error('No authenticated account');
  }

  const request = { ...tokenRequest, account: currentAccount };

  try {
    const response = await msalInstance.acquireTokenSilent(request);
    return response.accessToken;
  } catch (error) {
    if (error instanceof msal.InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup(request);
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * 현재 계정 정보 반환
 */
export function getCurrentAccount() {
  return currentAccount;
}

/**
 * MSAL 인스턴스 반환
 */
export function getMsalInstance() {
  return msalInstance;
}
