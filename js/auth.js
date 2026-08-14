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

// 리다이렉트 응답 처리
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().then(resp => {
    if(resp) {
      msalInstance.setActiveAccount(resp.account);
    }
  });
});

window.AUTH = {
  /** 로그인 (팝업) */
  async login() {
    const loginRequest = { scopes: CONFIG.scopes };
    try {
      const resp = await msalInstance.loginPopup(loginRequest);
      msalInstance.setActiveAccount(resp.account);
      return resp.account;
    } catch(e) {
      console.error("Login failed:", e);
      throw e;
    }
  },

  /** 로그아웃 */
  async logout() {
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
    const account = this.getAccount();
    if(!account) throw new Error("No account");
    const tokenRequest = { scopes: CONFIG.scopes, account };
    try {
      const resp = await msalInstance.acquireTokenSilent(tokenRequest);
      return resp.accessToken;
    } catch(e) {
      const resp = await msalInstance.acquireTokenPopup(tokenRequest);
      return resp.accessToken;
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
