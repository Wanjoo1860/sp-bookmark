/**
 * [auth/token-helper.js]
 * 액세스 토큰 획득 헬퍼
 * ─────────────────────────────────────────
 * [용도] Graph API 호출 전 반드시 이 함수로 토큰 획득
 */
import { getMsalInstance } from './msal-instance.js';
import { getActiveAccount } from './auth-guard.js';
import { tokenRequest } from '../config/auth.config.js';

export async function getAccessToken(scopes) {
  const instance = getMsalInstance();
  const account = getActiveAccount();

  if (!account) {
    throw new Error('NO_ACCOUNT');
  }

  const request = {
    scopes: scopes || tokenRequest.scopes,
    account: account
  };

  try {
    const response = await instance.acquireTokenSilent(request);
    return response.accessToken;
  } catch (error) {
    if (error instanceof msal.InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect(request);
      return null; // 리다이렉트 발생
    }
    throw error;
  }
}
