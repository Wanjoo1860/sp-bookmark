// ============================================================
// Graph API 호출 헬퍼
// ============================================================

/**
 * Graph API 범용 호출 (토큰 자동 갱신)
 */
async function graphCall(url, method, body) {
    await ensureToken();
    var options = {
        method: method || 'GET',
        headers: {
            'Authorization': 'Bearer ' + APP.accessToken,
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    var response = await fetch(url, options);

    // 401이면 토큰 갱신 후 재시도
    if (response.status === 401) {
        await getToken(true);
        options.headers['Authorization'] = 'Bearer ' + APP.accessToken;
        response = await fetch(url, options);
    }

    if (method === 'DELETE' && response.status === 204) return null;
    if (response.status === 204) return null;
    if (!response.ok) {
        var errText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errText);
    }
    return await response.json();
}

/**
 * Graph API GET
 */
async function graphGet(url) {
    return await graphCall(url, 'GET');
}

/**
 * Graph API POST (응답 JSON 반환)
 */
async function graphPost(url, body) {
    return await graphCall(url, 'POST', body);
}

/**
 * Graph API PATCH
 */
async function graphPatch(url, body) {
    return await graphCall(url, 'PATCH', body);
}

/**
 * Graph API DELETE
 */
async function graphDelete(url) {
    return await graphCall(url, 'DELETE');
}

/**
 * 토큰 확보 보장
 */
async function ensureToken() {
    if (!APP.accessToken) {
        await getToken();
    }
}
