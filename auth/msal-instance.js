/**
 * MSAL 인스턴스 초기화 및 관리
 */
import { msalConfig, loginRequest, tokenRequest } from '../config/auth.config.js';

let msalInstance = null;
let currentAccount = null;

/**
 * 전역 msal 라이브러리 참조
 */
function getMsalLib() {
  if (typeof msal !== 'undefined') return msal;
  if (typeof window !== 'undefined' && window.msal) return window.msal;
  throw new ReferenceError(
    'MSAL 라이브러리가 로드되지 않았습니다. ' +
    'index.html에서 msal-browser.min.js 스크립트가 올바르게 포함되어 있는지 확인하세요.'
  );
}

/**
 * MSAL 초기화
 */
export async function initializeMsal() {
  const msalLib = getMsalLib();
  msalInstance = new msalLib.PublicClientApplication(msalConfig);
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
      await msalInstance.loginRedirect(loginRequest);
    }
    throw error;
  }
}

/**
 * 로그아웃
 */
export async function logout() {
  try {
    await msalInstance.logoutPopup({
      account: currentAccount,
      postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
    });
  } catch (error) {
    if (error.errorCode === 'popup_window_error' || error.errorCode === 'empty_window_error') {
      await msalInstance.logoutRedirect({
        account: currentAccount,
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
      });
    } else {
      throw error;
    }
  }
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
    const msalLib = getMsalLib();
    if (error instanceof msalLib.InteractionRequiredAuthError) {
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
