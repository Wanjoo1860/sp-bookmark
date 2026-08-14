// ============================================================
// MSAL v4 인증 (Redirect + Teams NAA)
// ============================================================

(async function initAuth() {
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
    } catch (e) {
        APP.isInTeams = false;
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
            showLoginScreen();
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

        // Redirect 복귀 처리
        try {
            var redirectResp = await APP.msalInstance.handleRedirectPromise();
            if (redirectResp && redirectResp.account) {
                APP.msalInstance.setActiveAccount(redirectResp.account);
                APP.accessToken = redirectResp.accessToken || null;
                if (!APP.accessToken) await getToken();
                APP.msalReady = true;
                await onLoginSuccess();
                return;
            }
        } catch (e) {
            console.error('[MSAL] Redirect 처리 오류:', e.message);
        }

        APP.msalReady = true;
    }

    // ─── 3. 자동 로그인 시도 ───
    if (APP.isInTeams) {
        try {
            var tr = await APP.msalInstance.acquireTokenSilent({ scopes: CONFIG.scopes });
            APP.accessToken = tr.accessToken;
            if (tr.account) APP.msalInstance.setActiveAccount(tr.account);
            await onLoginSuccess();
        } catch (e) {
            try {
                var tr2 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
                APP.accessToken = tr2.accessToken;
                APP.msalInstance.setActiveAccount(tr2.account);
                await onLoginSuccess();
            } catch (e2) {
                showLoginScreen();
            }
        }
    } else {
        var accounts = APP.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            APP.msalInstance.setActiveAccount(accounts[0]);
            try {
                await getToken();
                await onLoginSuccess();
            } catch (e) {
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }
    }
})();

// ─── 수동 로그인 ───
async function login() {
    if (!APP.msalReady) {
        toast('초기화 중... 잠시 후 다시 시도하세요.');
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
            await onLoginSuccess();
        } else {
            await APP.msalInstance.loginRedirect({ scopes: CONFIG.scopes });
        }
    } catch (e) {
        document.getElementById('loginStatus').textContent = '로그인 실패: ' + e.message;
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg> Microsoft로 로그인';
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
        if (APP.isInTeams) {
            var r2 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
            APP.accessToken = r2.accessToken;
        } else {
            await APP.msalInstance.acquireTokenRedirect({ scopes: CONFIG.scopes });
        }
    }
}

// ─── 로그아웃 ───
function logout() {
    if (APP.isInTeams) {
        APP.msalInstance.setActiveAccount(null);
        APP.accessToken = null;
        APP.currentUserRole = 'user';
        document.body.classList.remove('is-admin');
        showLoginScreen();
    } else {
        APP.msalInstance.logoutRedirect({ postLogoutRedirectUri: CONFIG.redirectUri });
    }
}

// ─── 로그인 성공 후 처리 ───
async function onLoginSuccess() {
    try {
        var me = await graphGet(CONFIG.graphUrl + '/me');
        APP.currentUserId = me.id;
        APP.currentUserEmail = (me.mail || me.userPrincipalName || '').toLowerCase();
        APP.currentUser = {
            id: me.id,
            email: APP.currentUserEmail,
            name: me.displayName || APP.currentUserEmail
        };

        // 역할 확인
        await checkUserRole();

        // UI 전환
        showAppScreen();

        // 데이터 로드
        await loadBookmarks();

    } catch (e) {
        console.error('[Auth] 후처리 실패:', e.message);
        document.getElementById('loginStatus').textContent = '사용자 정보 로드 실패: ' + e.message;
        showLoginScreen();
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
        // $filter 미지원 시 대안
        try {
            var data2 = await graphGet(CONFIG.graphUrl + '/groups/' + CONFIG.groupId + '/members');
            var members = data2.value || [];
            var found = members.some(function(m) { return m.id === APP.currentUserId; });
            APP.currentUserRole = found ? 'admin' : 'user';
        } catch (e2) {
            APP.currentUserRole = 'user';
        }
    }

    document.body.classList.toggle('is-admin', APP.currentUserRole === 'admin');
}

// ─── 화면 전환 ───
function showLoginScreen() {
    document.getElementById('loginWrap').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
}

function showAppScreen() {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('footerUser').textContent = APP.currentUser.name;

    // 관리자 탭 표시 여부
    var tabUsers = document.getElementById('tabUsers');
    if (APP.currentUserRole === 'admin') {
        tabUsers.style.display = '';
    } else {
        tabUsers.style.display = 'none';
    }
}
