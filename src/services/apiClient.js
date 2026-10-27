import { getIdentityScope, IdentityStore } from '../features/auth/identityStore';

// API Client for the NestJS API, including the in-memory session lifecycle.

const API_BASE_URL = '/api';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const _apiCache = new Map();
let _authToken = null;
let _refreshPromise = null;
let _logoutPromise = null;
let _loginPromise = null;
let _sessionVersion = 0;
let _cacheVersion = 0;
let _sessionEnded = false;

if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('tinyhouse_jwt');
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  ...(_authToken
    ? { Authorization: `Bearer ${_authToken}` }
    : {}),
});

function clearCache() {
  _cacheVersion += 1;
  _apiCache.clear();
}

function assertCurrentSession(version) {
  if (version !== _sessionVersion) {
    const error = new Error('Phiên đăng nhập đã thay đổi.');
    error.code = 'SESSION_CHANGED';
    throw error;
  }
}

function endSession() {
  _sessionVersion += 1;
  _sessionEnded = true;
  _authToken = null;
  clearCache();
  IdentityStore.set(null);
}

function acceptIdentity(user) {
  const previous = IdentityStore.get();
  if (previous && getIdentityScope(previous) !== getIdentityScope(user)) _sessionVersion += 1;
  clearCache();
  IdentityStore.set(user);
}

function acceptSession(result) {
  if (!result?.success || !result?.accessToken || !result?.user) {
    throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
  }

  _sessionEnded = false;
  _authToken = String(result.accessToken);
  acceptIdentity(result.user);
  return result;
}

const invalidateCache = (endpoint) => {
  _cacheVersion += 1;
  const segments = endpoint
    .split('?')[0]
    .split('/')
    .filter(Boolean);

  const baseResource =
    segments[0] === 'v2' ? segments[1] : segments[0];

  if (!baseResource) {
    _apiCache.clear();
    return;
  }

  for (const key of _apiCache.keys()) {
    const keySegments = key
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    const keyResource =
      keySegments[0] === 'v2'
        ? keySegments[1]
        : keySegments[0];

    if (keyResource === baseResource) {
      _apiCache.delete(key);
    }
  }
};

async function parseResponse(response, unwrapData = true) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error ||
        payload?.message ||
        `HTTP ${response.status}`,
    );

    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return unwrapData && payload?.data !== undefined
    ? payload.data
    : payload;
}

function isRefreshExcluded(endpoint) {
  return [
    '/v2/auth/login',
    '/v2/auth/register',
    '/v2/auth/refresh',
    '/v2/auth/logout',
    '/v2/auth/forgot-password',
    '/v2/auth/reset-password',
  ].some((authEndpoint) =>
    endpoint.startsWith(authEndpoint),
  );
}

async function refreshAccessToken() {
  if (_sessionEnded) {
    const error = new Error('Phiên đăng nhập đã kết thúc.');
    error.status = 401;
    throw error;
  }

  if (_refreshPromise) {
    return _refreshPromise;
  }

  const version = _sessionVersion;
  const pendingRefresh = (async () => {
    const response = await fetch(
      `${API_BASE_URL}/v2/auth/refresh`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );

    const result = await parseResponse(response);
    assertCurrentSession(version);
    return acceptSession(result);
  })();

  _refreshPromise = pendingRefresh;

  try {
    return await pendingRefresh;
  } catch (error) {
    assertCurrentSession(version);
    if (error?.status === 401 || error?.status === 403) {
      endSession();
    }
    throw error;
  } finally {
    if (_refreshPromise === pendingRefresh) _refreshPromise = null;
  }
}

async function request(
  endpoint,
  init = {},
  options = {},
) {
  const version = _sessionVersion;
  const requestToken = _authToken;
  const {
    retryAuth = true,
    unwrapData = true,
  } = options;

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...init,
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        ...(init.headers || {}),
      },
    },
  );

  assertCurrentSession(version);

  if (
    response.status === 401 &&
    retryAuth &&
    !isRefreshExcluded(endpoint)
  ) {
    // Another request may already have renewed the token while this 401
    // response was in transit.
    if (!(_authToken && _authToken !== requestToken)) await refreshAccessToken();
    assertCurrentSession(version);

    return request(
      endpoint,
      init,
      {
        ...options,
        retryAuth: false,
      },
    );
  }

  try {
    const result = await parseResponse(response, unwrapData);
    assertCurrentSession(version);
    return result;
  } catch (error) {
    assertCurrentSession(version);
    if (error?.status === 401 && !isRefreshExcluded(endpoint)) endSession();
    throw error;
  }
}

export const ApiClient = {
  getToken() {
    return _authToken;
  },

  setToken(token) {
    _sessionVersion += 1;
    _sessionEnded = !token;
    _authToken = token ? String(token) : null;
    clearCache();
  },

  getSessionVersion() {
    return _sessionVersion;
  },

  acceptIdentity(user) {
    acceptIdentity(user);
  },

  removeToken() {
    endSession();

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tinyhouse_jwt');
    }
  },

  clearCache() {
    clearCache();
  },

  async loginSession(payload) {
    const pendingRefresh = _refreshPromise;
    const pendingLogout = _logoutPromise;
    const previousLogin = _loginPromise;
    endSession();
    const version = _sessionVersion;

    // Let an old refresh finish before sending credentials: its Set-Cookie
    // response must not arrive after the new login or logout response.
    const pendingLogin = (async () => {
      await pendingLogout?.catch(() => undefined);
      await previousLogin?.catch(() => undefined);
      await pendingRefresh?.catch(() => undefined);
      assertCurrentSession(version);

      const result = await request('/v2/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      assertCurrentSession(version);
      _sessionVersion += 1;
      return acceptSession(result);
    })();
    _loginPromise = pendingLogin;
    try {
      return await pendingLogin;
    } finally {
      if (_loginPromise === pendingLogin) _loginPromise = null;
    }
  },

  async logoutSession() {
    if (_logoutPromise) return _logoutPromise;

    const pendingRefresh = _refreshPromise;
    const pendingLogin = _loginPromise;
    endSession();
    const pendingLogout = (async () => {
      await pendingRefresh?.catch(() => undefined);
      await pendingLogin?.catch(() => undefined);
      return request('/v2/auth/logout', {
        method: 'POST',
        body: '{}',
      });
    })();
    _logoutPromise = pendingLogout;
    try {
      return await pendingLogout;
    } finally {
      if (_logoutPromise === pendingLogout) _logoutPromise = null;
    }
  },

  async refreshSession() {
    return refreshAccessToken();
  },

  async get(endpoint, options = {}) {
    const version = _sessionVersion;
    const cacheVersion = _cacheVersion;
    const {
      bypassCache = false,
      ttl = DEFAULT_CACHE_TTL_MS,
    } = options;

    const cacheKey = endpoint;
    const now = Date.now();

    if (!bypassCache && _apiCache.has(cacheKey)) {
      const entry = _apiCache.get(cacheKey);

      if (now - entry.timestamp < entry.ttl) {
        return entry.data;
      }

      _apiCache.delete(cacheKey);
    }

    try {
      const payload = await request(endpoint);
      assertCurrentSession(version);

      if (!bypassCache && cacheVersion === _cacheVersion) {
        _apiCache.set(cacheKey, {
          data: payload,
          timestamp: now,
          ttl,
        });
      }

      return payload;
    } catch (error) {
      assertCurrentSession(version);
      const status = Number(error?.status || 0);

      if (status === 401 || status === 403 || error?.code === 'SESSION_CHANGED') {
        throw error;
      }

      console.warn(
        `[ApiClient] GET ${endpoint} failed, fallback to stale cache:`,
        error.message,
      );

      if (
        !bypassCache &&
        _apiCache.has(cacheKey)
      ) {
        return _apiCache.get(cacheKey).data;
      }

      return null;
    }
  },

  async post(endpoint, body, options = {}) {
    invalidateCache(endpoint);

    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }, options);
  },

  async put(endpoint, body) {
    invalidateCache(endpoint);

    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    });
  },

  async patch(endpoint, body) {
    invalidateCache(endpoint);

    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    });
  },

  /** @param {string} endpoint @param {unknown} [body] */
  async delete(endpoint, body = undefined) {
    invalidateCache(endpoint);

    return request(endpoint, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  },
};
