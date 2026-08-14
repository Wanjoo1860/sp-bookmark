// ============================================================
// Graph API 호출 헬퍼
// ============================================================

async function ensureToken() {
    if (!APP.accessToken) {
        await getToken();
    }
}

async function graphCall(url, method, body) {
    await ensureToken();
    var options = {
        method: method || 'GET',
        headers: {
            'Authorization': 'Bearer ' + APP.accessToken,
            'Content-Type': 'application/json',
            'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    var response = await fetch(url, options);

    // 401 → 토큰 갱신 후 재시도
    if (response.status === 401) {
        await getToken(true);
        options.headers['Authorization'] = 'Bearer ' + APP.accessToken;
        response = await fetch(url, options);
    }

    if (response.status === 204) return null;
    if (!response.ok) {
        var errText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errText);
    }
    return await response.json();
}

async function graphGet(url) {
    return await graphCall(url, 'GET');
}

async function graphPost(url, body) {
    return await graphCall(url, 'POST', body);
}

async function graphPatch(url, body) {
    return await graphCall(url, 'PATCH', body);
}

async function graphDelete(url) {
    await ensureToken();
    var options = {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + APP.accessToken,
            'Content-Type': 'application/json'
        }
    };

    var response = await fetch(url, options);
    if (response.status === 401) {
        await getToken(true);
        options.headers['Authorization'] = 'Bearer ' + APP.accessToken;
        response = await fetch(url, options);
    }
    if (response.status === 204 || response.status === 200) return null;
    if (!response.ok) {
        var errText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errText);
    }
    return null;
}
