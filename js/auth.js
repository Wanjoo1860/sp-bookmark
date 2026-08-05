/**
 * auth.js — MSAL 인증 (자동 로그인 + 팝업 폴백)
 * 의존성: config.js, graph.js, msal-browser CDN
 */
var Auth = (function() {
  'use strict';

  var msalInstance = null;
  var currentAccount = null;
  var currentUserRole = 'user'; // 'admin' | 'user'
  var currentUserProfile = null;

  /**
   * MSAL 초기화
   */
  function init() {
    var msalConfig = {
      auth: {
        clientId: CONFIG.clientId,
        authority: 'https://login.microsoftonline.com/' + CONFIG.tenantId,
        redirectUri: CONFIG.redirectUri
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      },
      system: {
        loggerOptions: {
          logLevel: msal.LogLevel.Warning
        }
      }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
  }

  /**
   * 자동 로그인 시도 (사일런트)
   * @returns {boolean} 성공 여부
   */
  async function trySilentLogin() {
    var accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return false;

    currentAccount = accounts[0];
    try {
      await getToken(); // 토큰 획득 테스트
      return true;
    } catch (e) {
      currentAccount = null;
      return false;
    }
  }

  /**
   * 팝업 로그인
   */
  async function loginPopup() {
    var request = { scopes: CONFIG.scopes };
    try {
      var response = await msalInstance.loginPopup(request);
      currentAccount = response.account;
      return true;
    } catch (e) {
      throw e;
    }
  }

  /**
   * 토큰 획득 (사일런트 → 팝업 폴백)
   */
  async function getToken() {
    if (!currentAccount) throw new Error('로그인이 필요합니다.');

    var request = {
      scopes: CONFIG.scopes,
      account: currentAccount
    };

    try {
      var response = await msalInstance.acquireTokenSilent(request);
      return response.accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) {
        var response2 = await msalInstance.acquireTokenPopup(request);
        return response2.accessToken;
      }
      throw e;
    }
  }

  /**
   * 로그아웃
   */
  async function logout() {
    if (msalInstance && currentAccount) {
      await msalInstance.logoutPopup({
        account: currentAccount,
        postLogoutRedirectUri: CONFIG.redirectUri
      });
    }
    currentAccount = null;
    currentUserRole = 'user';
    currentUserProfile = null;
  }

  /**
   * 현재 사용자 프로필 로드
   */
  async function loadProfile() {
    var profile = await Graph.get('/me');
    currentUserProfile = {
      id: profile.id,
      displayName: profile.displayName || profile.userPrincipalName,
      email: (profile.mail || profile.userPrincipalName || '').toLowerCase(),
      initials: (profile.displayName || 'U').charAt(0).toUpperCase()
    };
    return currentUserProfile;
  }

  /**
   * 관리자 역할 확인
   */
  async function checkAdminRole() {
    try {
      var result = await Graph.get('/me/memberOf');
      var groups = result.value || [];
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].id === CONFIG.adminGroupId) {
          currentUserRole = 'admin';
          return 'admin';
        }
      }
    } catch (e) {
      console.warn('관리자 역할 확인 실패:', e.message);
    }
    currentUserRole = 'user';
    return 'user';
  }

  /**
   * 전체 초기화 및 인증 플로우
   * @returns {{ success: boolean, needLogin: boolean }}
   */
  async function initialize() {
    init();
    Graph.setTokenProvider(getToken);

    var silent = await trySilentLogin();
    if (silent) {
      await loadProfile();
      await checkAdminRole();
      return { success: true, needLogin: false };
    }
    return { success: false, needLogin: true };
  }

  /**
   * 로그인 후 초기화
   */
  async function loginAndInit() {
    await loginPopup();
    Graph.setTokenProvider(getToken);
    await loadProfile();
    await checkAdminRole();
  }

  // Public API
  return {
    initialize: initialize,
    loginAndInit: loginAndInit,
    logout: logout,
    getToken: getToken,
    getProfile: function() { return currentUserProfile; },
    getRole: function() { return currentUserRole; },
    isAdmin: function() { return currentUserRole === 'admin'; }
  };
})();
