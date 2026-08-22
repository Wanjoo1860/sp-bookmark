/**
 * MSAL 인증 설정
 * Azure AD App Registration 정보
 */
export const msalConfig = {
  auth: {
    clientId: 'c33acf54-975e-45dc-9577-17df0296f4f4',
    authority: 'https://login.microsoftonline.com/77ad8ab8-7d87-4c2c-a442-8d26f9c8fab1',
    redirectUri: 'https://sp-bookmark.wjlee1860.workers.dev',
    postLogoutRedirectUri: 'https://sp-bookmark.wjlee1860.workers.dev'
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

export const loginRequest = {
  scopes: [
    'User.Read',
    'User.Read.All',
    'User.Invite.All',
    'Sites.ReadWrite.All',
    'GroupMember.ReadWrite.All',
    'Group.ReadWrite.All'
  ]
};

export const tokenRequest = {
  scopes: [
    'User.Read',
    'User.Read.All',
    'User.Invite.All',
    'Sites.ReadWrite.All',
    'GroupMember.ReadWrite.All',
    'Group.ReadWrite.All'
  ]
};
