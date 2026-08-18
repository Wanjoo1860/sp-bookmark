/**
 * [auth/auth-guard.js]
 * 인증 상태 확인 및 로그인/로그아웃 제어
 * ─────────────────────────────────────────
 * [대체 대상] 기존 checkSession(), showLoginScreen(), clearSession()
 */
import { getMsalInstance } from './msal-instance.js';
import { loginRequest, msalConfig } from '../config/auth.config.js';

export function getActiveAccount() {
  const instance = getMsalInstance();
  let account = instance.getActiveAccount();
  if (account) return account;

  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    instance.setActiveAccount(accounts[0]);
    return accounts[0];
  }
  return null;
}

export function isAuthenticated() {
  return getActiveAccount() !== null;
}

export async function loginRedirect() {
  const instance = getMsalInstance();
  await instance.loginRedirect(loginRequest);
}

export async function logoutRedirect() {
  const instance = getMsalInstance();
  await instance.logoutRedirect({
    postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
  });
}
