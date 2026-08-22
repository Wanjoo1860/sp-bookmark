/**
 * 인증 가드 — 앱 진입 제어
 */
import { initializeMsal, login, logout, getCurrentAccount } from './msal-instance.js';
import { resolveUserRole, clearRoleCache } from './role-resolver.js';
import { clearTokenCache } from './token-helper.js';
import { roleConfig } from '../config/role.config.js';

let authState = {
  isAuthenticated: false,
  account: null,
  role: null,
  email: null,
  displayName: null
};

// 상태 변경 리스너
let onAuthStateChange = null;

/**
 * 인증 상태 변경 콜백 등록
 */
export function setAuthStateListener(callback) {
  onAuthStateChange = callback;
}

/**
 * 앱 초기화 시 인증 확인
 */
export async function checkAuth() {
  try {
    const account = await initializeMsal();

    if (account) {
      const userInfo = await resolveUserRole();
      authState = {
        isAuthenticated: true,
        account: account,
        role: userInfo.role,
        email: userInfo.email,
        displayName: userInfo.displayName
      };
    } else {
      authState = { isAuthenticated: false, account: null, role: null, email: null, displayName: null };
    }
  } catch (error) {
    console.error('[AuthGuard] checkAuth error:', error);
    authState = { isAuthenticated: false, account: null, role: null, email: null, displayName: null };
  }

  if (onAuthStateChange) onAuthStateChange(authState);
  return authState;
}

/**
 * 로그인 처리
 */
export async function handleLogin() {
  try {
    await login();
    const userInfo = await resolveUserRole();
    authState = {
      isAuthenticated: true,
      account: getCurrentAccount(),
      role: userInfo.role,
      email: userInfo.email,
      displayName: userInfo.displayName
    };

    if (onAuthStateChange) onAuthStateChange(authState);
    return authState;
  } catch (error) {
    console.error('[AuthGuard] login error:', error);
    throw error;
  }
}

/**
 * 로그아웃 처리
 */
export async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    console.error('[AuthGuard] logout error:', error);
  } finally {
    clearTokenCache();
    clearRoleCache();
    authState = { isAuthenticated: false, account: null, role: null, email: null, displayName: null };
    if (onAuthStateChange) onAuthStateChange(authState);
  }
}

/**
 * 현재 인증 상태 반환
 */
export function getAuthState() {
  return { ...authState };
}

/**
 * 권한 확인
 */
export function hasPermission(permission) {
  if (!authState.role) return false;
  const perms = roleConfig.permissions[authState.role] || [];
  return perms.includes(permission);
}

/**
 * 역할 확인
 */
export function isRole(role) {
  return authState.role === role;
}
