/**
 * [config/auth.config.js]
 * MSAL 인증 설정값
 * ─────────────────────────────────────────
 * [AI 수정 가이드] 환경 변경 시 이 파일의 값만 변경
 */
export const msalConfig = {
  auth: {
    clientId: "c33acf54-975e-45dc-9577-17df0296f4f4",
    authority: "https://login.microsoftonline.com/77ad8ab8-7d87-4c2c-a442-8d26f9c8fab1",
    redirectUri: "https://sp-bookmark.wjlee1860.workers.dev/",
    postLogoutRedirectUri: "https://sp-bookmark.wjlee1860.workers.dev/"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  }
};

export const loginRequest = {
  scopes: ["User.Read"]
};

export const tokenRequest = {
  scopes: [
    "User.Read",
    "User.Read.All",
    "Sites.ReadWrite.All",
    "GroupMember.Read.All",
    "Group.ReadWrite.All"
  ]
};

