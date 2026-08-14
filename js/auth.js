;(function(){
'use strict';

const msalConfig = {
  auth: {
    clientId: CONFIG.clientId,
    authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`,
    redirectUri: CONFIG.redirectUri
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

let initialized = false;
let loginInProgress = false;

// ★ 초기화 Promise — 다른 모듈에서 await 가능
const ready = msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise();
}).then(resp => {
  if(resp) {
    msalInstance.setActiveAccount(resp.account);
  }
  initialized = true;
}).catch(err => {
  console.error("MSAL init error:", err);
  initialized = true;
});

window.AUTH = {
  /** 초기화 완료 대기 */
  ready,

  /** 로그인 (팝업) */
  async login() {
    await ready;
    if(loginInProgress) {
      console.warn("Login already in progress");
      return null;
    }
    loginInProgress = true;
    const loginRequest = { scopes: CONFIG.scopes };
    try {
      const resp = await msalInstance.loginPopup(loginRequest);
      msalInstance.setActiveAccount(resp.account);
      loginInProgress = false;
      return resp.account;
    } catch(e) {
      loginInProgress = false;
      if(e.errorCode === "interaction_in_progress") {
        console.warn("Interaction in progress — ignored");
        return null;
      }
      console.error("Login failed:", e);
      throw e;
    }
  },

  /** 로그아웃 */
  async logout() {
    await ready;
    const account = msalInstance.getActiveAccount();
    if(account) {
      await msalInstance.logoutPopup({ account });
    }
  },

  /** 현재 계정 가져오기 */
  getAccount() {
    let account = msalInstance.getActiveAccount();
    if(!account) {
      const accounts = msalInstance.getAllAccounts();
      if(accounts.length > 0) {
        account = accounts[0];
        msalInstance.setActiveAccount(account);
      }
    }
    return account;
  },

  /** 액세스 토큰 가져오기 (silent → popup fallback) */
  async getToken() {
    await ready;
    const account = this.getAccount();
    if(!account) throw new Error("No account");
    const tokenRequest = { scopes: CONFIG.scopes, account };
    try {
      const resp = await msalInstance.acquireTokenSilent(tokenRequest);
      return resp.accessToken;
    } catch(e) {
      if(loginInProgress) {
        throw new Error("Login in progress");
      }
      loginInProgress = true;
      try {
        const resp = await msalInstance.acquireTokenPopup(tokenRequest);
        loginInProgress = false;
        return resp.accessToken;
      } catch(e2) {
        loginInProgress = false;
        throw e2;
      }
    }
  },

  /** 현재 사용자 정보 */
  getUserInfo() {
    const account = this.getAccount();
    if(!account) return null;
    return {
      id: account.localAccountId,
      email: account.username,
      name: account.name || account.username
    };
  }
};

})();
