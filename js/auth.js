// ============================================================
// 인증 (MSAL v4 + Teams NAA)
// 자동 로그인 실패 시 상단 로그인 버튼 표시
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
                redirectUri: CONFIG.redirectUri
            },
            cache: { cacheLocation: 'localStorage' }
        });

        await APP.msalInstance.initialize();

        // 리디렉트 복귀 처리
        try {
            var redirectResp = await APP.msalInstance.handleRedirectPromise();
            if (redirectResp && redirectResp.account) {
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

    // ─── 3. 자동 로그인 시도 ───
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
            // 로그인된 계정 없음 → 로그인 버튼 표시
            showLoginButton();
        }
    }
})();

// ─── 수동 로그인 ───
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
        } else {
            try {
                var popupResp = await APP.msalInstance.loginPopup({ scopes: CONFIG.scopes });
                APP.msalInstance.setActiveAccount(popupResp.account);
                if (popupResp.accessToken) {
                    APP.accessToken = popupResp.accessToken;
                } else {
                    await getToken();
                }
            } catch (popupErr) {
                if (popupErr.errorCode === 'user_cancelled') {
                    btn.disabled = false;
                    btn.textContent = 'Microsoft로 로그인';
                    return;
                }
                // Popup 실패 → redirect 폴백
                await APP.msalInstance.loginRedirect({ scopes: CONFIG.scopes });
                return;
            }
        }
        onLoginSuccess();
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
        if (APP.isInTeams) {
            var r2 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
            APP.accessToken = r2.accessToken;
        } else {
            try {
                var r3 = await APP.msalInstance.acquireTokenPopup({ scopes: CONFIG.scopes });
                APP.accessToken = r3.accessToken;
            } catch (e2) {
                await APP.msalInstance.acquireTokenRedirect({ scopes: CONFIG.scopes });
            }
        }
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
        var account = APP.msalInstance.getActiveAccount();
        APP.msalInstance.logoutPopup({
            account: account,
            postLogoutRedirectUri: CONFIG.redirectUri
        }).catch(function() {
            APP.msalInstance.logoutRedirect({ postLogoutRedirectUri: CONFIG.redirectUri });
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

        // 역할 확인
        await checkUserRole();

        // UI 전환
        hideLoginButton();
        showLoggedInUI();

        // 데이터 로드
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
        if (data.value && data.value.length > 0) {
            APP.currentUserRole = 'admin';
        } else {
            APP.currentUserRole = 'user';
        }
    } catch (e) {
        console.warn('[권한] 확인 실패:', e.message);
        APP.currentUserRole = 'user';
    }
}

// ─── UI 헬퍼 ───
function showLoginButton() {
    document.getElementById('btnMsLogin').style.display = 'inline-flex';
    document.getElementById('btnMsLogin').disabled = false;
    document.getElementById('btnMsLogin').textContent = 'Microsoft로 로그인';
    document.getElementById('welcomeMsg').textContent = '로그인 후 이용할 수 있습니다.';
}

function hideLoginButton() {
    document.getElementById('btnMsLogin').style.display = 'none';
}

function showLoggedInUI() {
    // 상단 사용자 이름
    var topName = document.getElementById('topUserName');
    topName.textContent = APP.currentUser.name;
    topName.style.display = 'inline';

    // 사이드바 하단
    document.getElementById('sidebarUser').textContent =
        APP.currentUserRole === 'admin' ? 'admin' : APP.currentUser.name;
    document.getElementById('btnLogout').style.display = 'inline-flex';

    // 관리자 UI
    if (APP.currentUserRole === 'admin') {
        document.getElementById('btnSettings').style.display = 'inline-flex';
        document.getElementById('adminToolbar').style.display = 'flex';
    }

    // 환영 메시지 변경
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
