// ============================================================
// 인증 (MSAL v4 — Redirect 방식)
// ============================================================

(async function initApp() {
    'use strict';

    // ─── 1. Teams 환경 감지 ───
    try {
        await Promise.race([
            microsoftTeams.app.initialize(),
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('timeout')); }, 500);
            })
        ]);
        APP.isInTeams = true;
        setEnvBadge('Teams', 'env-teams');
    } catch (e) {
        APP.isInTeams = false;
        setEnvBadge('Browser', 'env-browser');
    }

    // ─── 2. MSAL 초기화 ───
    if (APP.isInTeams) {
        try {
            APP.msalInstance = await msal.createNestablePublicClientApplication({
                auth: {
                    clientId: CONFIG.clientId,
                    authority: 'https://login.microsoftonline.com/' + CONFIG.tenantId,
                    supportsNestedAppAuth: true
                }
            });
            APP.msalReady = true;
        } catch (e) {
            console.error('[MSAL] NAA 실패:', e.message);
            showLoginButton();
            return;
        }
    } else {
        APP.msalInstance = new msal.PublicClientApplication({
            auth: {
                clientId: CONFIG.clientId,
                authority: 'https://login.microsoftonline.com/' + CONFIG.tenantId,
                redirectUri: CONFIG.redirectUri,
                navigateToLoginRequestUrl: true
            },
            cache: { cacheLocation: 'localStorage' }
        });

        await APP.msalInstance.initialize();
        console.log('[MSAL] initialize() 완료');

        // ★ 핵심: redirect에서 돌아온 경우 토큰 처리
        try {
            var redirectResp = await APP.msalInstance.handleRedirectPromise();
            if (redirectResp && redirectResp.account) {
                console.log('[MSAL] Redirect 복귀 — 토큰 수신');
                APP.msalInstance.setActiveAccount(redirectResp.account);
                APP.accessToken = redirectResp.accessToken || null;
                if (!APP.accessToken) await getToken();
                APP.msalReady = true;
                onLoginSuccess();
                return;
            }
        } catch (e) {
            console.error('[MSAL] Redirect 처리 오류:', e.message);
        }

        APP.msalReady = true;
    }

    // ─── 3. 자동 로그인 시도 (기존 세션) ───
    if (APP.isInTeams) {
        try {
            var tr = await APP.msalInstance.acquireTokenSilent({ scopes: CONFIG.scopes });
            APP.accessToken = tr.accessToken;
            if (tr.account) APP.msalInstance.setActiveAccount(tr.account);
            onLoginSuccess();
        } catch (e) {
            try {
                var tr2 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
                APP.accessToken = tr2.accessToken;
                APP.msalInstance.setActiveAccount(tr2.account);
                onLoginSuccess();
            } catch (e2) {
                showLoginButton();
            }
        }
    } else {
        var accounts = APP.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            APP.msalInstance.setActiveAccount(accounts[0]);
            try {
                await getToken();
                onLoginSuccess();
            } catch (e) {
                console.log('[MSAL] 자동 로그인 실패:', e.message);
                showLoginButton();
            }
        } else {
            showLoginButton();
        }
    }
})();

// ─── 수동 로그인 (Redirect 방식) ───
async function login() {
    if (!APP.msalReady) {
        showStatus('초기화 중... 잠시 후 다시 시도하세요.', 'error');
        return;
    }

    var btn = document.getElementById('btnMsLogin');
    btn.disabled = true;
    btn.textContent = '로그인 중...';

    try {
        if (APP.isInTeams) {
            try {
                var r = await APP.msalInstance.acquireTokenSilent({ scopes: CONFIG.scopes });
                APP.accessToken = r.accessToken;
                APP.msalInstance.setActiveAccount(r.account);
            } catch (e) {
                var r2 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
                APP.accessToken = r2.accessToken;
                APP.msalInstance.setActiveAccount(r2.account);
            }
            onLoginSuccess();
        } else {
            // ★ 브라우저: redirect 방식으로 로그인
            await APP.msalInstance.loginRedirect({
                scopes: CONFIG.scopes
            });
            // 이 이후 코드는 실행되지 않음 (페이지가 리디렉트됨)
        }
    } catch (e) {
        showStatus('로그인 실패: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Microsoft로 로그인';
    }
}

// ─── 토큰 획득 ───
async function getToken(forceRefresh) {
    var account = APP.msalInstance.getActiveAccount();
    if (!account) {
        var accounts = APP.msalInstance.getAllAccounts();
        if (accounts.length === 0) throw new Error('로그인 필요');
        account = accounts[0];
        APP.msalInstance.setActiveAccount(account);
    }

    try {
        var r = await APP.msalInstance.acquireTokenSilent({
            scopes: CONFIG.scopes,
            account: account,
            forceRefresh: !!forceRefresh
        });
        APP.accessToken = r.accessToken;
    } catch (e) {
        console.warn('[MSAL] Silent 실패, redirect로 토큰 요청');
        await APP.msalInstance.acquireTokenRedirect({ scopes: CONFIG.scopes });
    }
}

// ─── 로그아웃 ───
function logout() {
    if (APP.isInTeams) {
        APP.msalInstance.setActiveAccount(null);
        APP.accessToken = null;
        APP.currentUserRole = 'user';
        resetUI();
        showLoginButton();
    } else {
        APP.msalInstance.logoutRedirect({
            postLogoutRedirectUri: CONFIG.redirectUri
        });
    }
}

// ─── 로그인 성공 후 처리 ───
async function onLoginSuccess() {
    try {
        var me = await graphGet(CONFIG.graphUrl + '/me');
        APP.currentUserId = me.id;
        APP.currentUserEmail = me.mail || me.userPrincipalName || '';
        APP.currentUser = {
            id: me.id,
            email: APP.currentUserEmail,
            name: me.displayName || APP.currentUserEmail
        };

        await checkUserRole();
        hideLoginButton();
        showLoggedInUI();
        await loadBookmarks();
    } catch (e) {
        console.error('[Auth] 후처리 실패:', e.message);
        showStatus('사용자 정보 로드 실패: ' + e.message, 'error');
        showLoginButton();
    }
}

// ─── 역할 확인 ───
async function checkUserRole() {
    try {
        var data = await graphGet(
            CONFIG.graphUrl + '/me/memberOf?$filter=id eq \'' + CONFIG.groupId + '\''
        );
        APP.currentUserRole = (data.value && data.value.length > 0) ? 'admin' : 'user';
    } catch (e) {
        console.warn('[권한] 확인 실패:', e.message);
        APP.currentUserRole = 'user';
    }
}

// ─── UI 헬퍼 ───
function showLoginButton() {
    var btn = document.getElementById('btnMsLogin');
    btn.style.display = 'inline-flex';
    btn.disabled = false;
    btn.textContent = 'Microsoft로 로그인';
    document.getElementById('welcomeMsg').textContent = '로그인 후 이용할 수 있습니다.';
}

function hideLoginButton() {
    document.getElementById('btnMsLogin').style.display = 'none';
}

function showLoggedInUI() {
    var topName = document.getElementById('topUserName');
    topName.textContent = APP.currentUser.name;
    topName.style.display = 'inline';

    document.getElementById('sidebarUser').textContent =
        APP.currentUserRole === 'admin' ? 'admin' : APP.currentUser.name;
    document.getElementById('btnLogout').style.display = 'inline-flex';

    if (APP.currentUserRole === 'admin') {
        document.getElementById('btnSettings').style.display = 'inline-flex';
        document.getElementById('adminToolbar').style.display = 'flex';
    }

    document.getElementById('welcomeMsg').textContent = '왼쪽 메뉴에서 사이트를 선택하세요.';
}

function resetUI() {
    document.getElementById('topUserName').style.display = 'none';
    document.getElementById('sidebarUser').textContent = '';
    document.getElementById('btnLogout').style.display = 'none';
    document.getElementById('btnSettings').style.display = 'none';
    document.getElementById('adminToolbar').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('sidebarNav').innerHTML = '';
    document.getElementById('bookmarkGrid').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
}

function setEnvBadge(text, cls) {
    var el = document.getElementById('envBadge');
    el.textContent = text;
    el.className = 'env-badge ' + cls;
}
