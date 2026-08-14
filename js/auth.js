// ============================================================
// 인증 (MSAL v4 - Redirect 방식)
// ============================================================
;(async function() {
    'use strict';

    var msalConfig = {
        auth: {
            clientId: CONFIG.clientId,
            authority: 'https://login.microsoftonline.com/' + CONFIG.tenantId,
            redirectUri: CONFIG.redirectUri
        },
        cache: {
            cacheLocation: 'localStorage',
            storeAuthStateInCookie: false
        }
    };

    try {
        APP.msalInstance = new msal.PublicClientApplication(msalConfig);
        await APP.msalInstance.initialize();
        console.log('[AUTH] MSAL 초기화 완료');
    } catch (e) {
        console.error('[AUTH] MSAL 초기화 실패:', e);
        return;
    }

    // Redirect 복귀 처리
    try {
        var response = await APP.msalInstance.handleRedirectPromise();
        if (response) {
            console.log('[AUTH] Redirect 복귀 - 토큰 수신');
            APP.accessToken = response.accessToken;
            APP.msalInstance.setActiveAccount(response.account);
            await onLoginSuccess(response.account);
            return;
        }
    } catch (e) {
        console.error('[AUTH] handleRedirectPromise 에러:', e);
    }

    // 기존 세션 확인
    var accounts = APP.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        APP.msalInstance.setActiveAccount(accounts[0]);
        try {
            var silentResult = await APP.msalInstance.acquireTokenSilent({
                scopes: CONFIG.scopes,
                account: accounts[0]
            });
            APP.accessToken = silentResult.accessToken;
            console.log('[AUTH] Silent 토큰 획득 성공');
            await onLoginSuccess(accounts[0]);
        } catch (e) {
            console.log('[AUTH] Silent 실패 - 로그인 버튼 표시');
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }

    // 전역 함수 등록
    window.login = async function() {
        try {
            await APP.msalInstance.loginRedirect({ scopes: CONFIG.scopes });
        } catch (e) {
            document.getElementById('loginError').textContent = '로그인 실패: ' + e.message;
        }
    };

    window.logout = function() {
        APP.msalInstance.logoutRedirect({ postLogoutRedirectUri: CONFIG.redirectUri });
    };

    window.getToken = async function() {
        var account = APP.msalInstance.getActiveAccount();
        if (!account) throw new Error('로그인 필요');
        try {
            var result = await APP.msalInstance.acquireTokenSilent({
                scopes: CONFIG.scopes,
                account: account
            });
            APP.accessToken = result.accessToken;
            return result.accessToken;
        } catch (e) {
            await APP.msalInstance.acquireTokenRedirect({ scopes: CONFIG.scopes });
            throw new Error('토큰 갱신을 위해 리다이렉트');
        }
    };

    async function onLoginSuccess(account) {
        APP.currentUser = account;
        APP.currentUserEmail = account.username || '';
        APP.currentUserId = account.localAccountId || account.homeAccountId || '';

        // 관리자 여부 확인
        await checkUserRole();

        // UI 전환
        showApp();
    }

    async function checkUserRole() {
        try {
            var token = await getToken();
            var resp = await fetch(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (resp.ok) {
                var data = await resp.json();
                var members = data.value || [];
                APP.adminMembers = members;
                var found = members.find(function(m) {
                    return m.id === APP.currentUserId ||
                           (m.mail || m.userPrincipalName || '').toLowerCase() === APP.currentUserEmail.toLowerCase();
                });
                APP.currentUserRole = found ? 'admin' : 'user';
            } else {
                APP.currentUserRole = 'user';
            }
        } catch (e) {
            APP.currentUserRole = 'user';
        }
        console.log('[AUTH] 역할:', APP.currentUserRole);
    }

    function showLoginScreen() {
        document.getElementById('loginWrap').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
    }

    function showApp() {
        document.getElementById('loginWrap').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('footerUser').textContent = APP.currentUserEmail.split('@')[0];
        document.body.classList.toggle('is-admin', APP.currentUserRole === 'admin');

        // 관리자 버튼 표시
        if (APP.currentUserRole === 'admin') {
            document.getElementById('btnManager').style.display = '';
        }

        // 앱 초기화 트리거
        if (typeof window.initApp === 'function') {
            window.initApp();
        }
    }

    // 로그인 버튼 바인딩
    document.getElementById('btnMsLogin').addEventListener('click', function() {
        login();
    });

})();
