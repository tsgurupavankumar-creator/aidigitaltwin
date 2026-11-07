/**
 * Client-side CSRF support.
 *
 * The server (src/middleware.ts + src/lib/auth/csrf.ts) uses a double-submit
 * cookie: every mutating request to /api/* must carry an `x-csrf-token`
 * header whose value equals the `csrf_token` cookie. Before this module
 * existed nothing in the UI sent that header, so every POST/PATCH/DELETE
 * (signup, logout, course create/delete, agent runs, ...) was rejected with
 * 403 "Invalid CSRF token".
 *
 * `installCsrfFetch()` wraps window.fetch once, so existing call sites keep
 * working unchanged. The wrapper:
 *   - only touches same-origin requests to /api/* with an unsafe method,
 *     so the token is never sent to another origin;
 *   - fetches a fresh token first if the cookie is missing or has expired
 *     (the cookie lives for one hour), de-duplicating concurrent refreshes;
 *   - if the server still answers 403 "Invalid CSRF token", refreshes once
 *     and retries once (only when the request body can be replayed).
 *
 * The logic lives in createCsrfFetch() with every browser dependency
 * injected, so it is unit-tested in Node (tests/csrf-client.test.ts).
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_ENDPOINT = '/api/auth/csrf';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

declare global {
  interface Window {
    __csrfOriginalFetch?: typeof fetch;
    __csrfFetchInstalled?: boolean;
  }
}

export interface CsrfClientEnv {
  /** The real, unwrapped fetch. */
  fetch: typeof fetch;
  /** Returns the current `document.cookie` string. */
  getCookie: () => string;
  /** e.g. `window.location.origin`. */
  origin: string;
}

export function readCsrfToken(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${CSRF_COOKIE}=`)) {
      const value = trimmed.slice(CSRF_COOKIE.length + 1);
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

function isReplayable(body: BodyInit | null | undefined): boolean {
  if (body === undefined || body === null) return true;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return false;
  return true;
}

export function createCsrfFetch(env: CsrfClientEnv): typeof fetch {
  let inFlightRefresh: Promise<void> | null = null;

  const refreshToken = (): Promise<void> => {
    if (!inFlightRefresh) {
      inFlightRefresh = env
        .fetch(CSRF_ENDPOINT, { method: 'GET', credentials: 'same-origin' })
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => {
          inFlightRefresh = null;
        });
    }
    return inFlightRefresh;
  };

  const ensureToken = async (forceRefresh: boolean): Promise<string | null> => {
    if (!forceRefresh) {
      const existing = readCsrfToken(env.getCookie());
      if (existing) return existing;
    }
    await refreshToken();
    return readCsrfToken(env.getCookie());
  };

  const csrfAwareFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const rawUrl = request ? request.url : input instanceof URL ? input.href : String(input);

    let url: URL;
    try {
      url = new URL(rawUrl, env.origin);
    } catch {
      return env.fetch(input, init);
    }

    const needsToken =
      UNSAFE_METHODS.has(method) && url.origin === env.origin && url.pathname.startsWith('/api/');
    if (!needsToken) return env.fetch(input, init);

    const send = async (forceRefresh: boolean): Promise<Response> => {
      const token = await ensureToken(forceRefresh);
      const headers = new Headers(init?.headers ?? request?.headers);
      if (token) headers.set(CSRF_HEADER, token);
      if (request) return env.fetch(new Request(request, { ...init, headers }));
      return env.fetch(input, { ...init, headers });
    };

    const canRetry = !request && isReplayable(init?.body);
    const first = await send(false);
    if (first.status !== 403 || !canRetry) return first;

    const rejectedForCsrf = await first
      .clone()
      .json()
      .then((body: { error?: string } | null) => body?.error === 'Invalid CSRF token')
      .catch(() => false);
    if (!rejectedForCsrf) return first;

    return send(true);
  };

  return csrfAwareFetch as typeof fetch;
}

/** Wrap window.fetch once. Safe to call repeatedly (React StrictMode runs effects twice in dev). */
export function installCsrfFetch(): void {
  if (typeof window === 'undefined' || window.__csrfFetchInstalled) return;
  window.__csrfOriginalFetch = window.fetch.bind(window);
  window.fetch = createCsrfFetch({
    fetch: window.__csrfOriginalFetch,
    getCookie: () => document.cookie,
    origin: window.location.origin,
  });
  window.__csrfFetchInstalled = true;
}

/** A CSRF-aware fetch that is always built on the original fetch, so it never double-wraps. */
export function getBrowserCsrfFetch(): typeof fetch {
  if (typeof window === 'undefined') {
    throw new Error('csrfFetch can only be used in the browser.');
  }
  return createCsrfFetch({
    fetch: window.__csrfOriginalFetch ?? window.fetch.bind(window),
    getCookie: () => document.cookie,
    origin: window.location.origin,
  });
}
