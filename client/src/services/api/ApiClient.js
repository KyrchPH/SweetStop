const DEFAULT_API_BASE_URL = "http://localhost:4000/api/v1";
const SESSION_STORAGE_KEY = "sweetstop.api.session";

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.details = options.details;
    this.data = options.data;
  }
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function normalizePath(path) {
  if (typeof path !== "string" || path.trim() === "") {
    throw new ApiError("API path is required.");
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isJsonBody(body) {
  return (
    body !== undefined &&
    body !== null &&
    typeof body !== "string" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
}

function appendQuery(url, query) {
  if (!query || typeof query !== "object") {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

export class ApiClient {
  constructor(options = {}) {
    this.baseUrl = trimTrailingSlash(
      options.baseUrl || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
    );
    this.storageKey = options.storageKey || SESSION_STORAGE_KEY;
    this.requestGuards = [];
    this.refreshPromise = null;
  }

  getSession() {
    const stored = window.localStorage.getItem(this.storageKey);
    return stored ? safeJsonParse(stored) : null;
  }

  setSession(session) {
    if (!session) {
      this.clearSession();
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  clearSession() {
    window.localStorage.removeItem(this.storageKey);
  }

  getAccessToken() {
    return this.getSession()?.access_token ?? null;
  }

  getRefreshToken() {
    return this.getSession()?.refresh_token ?? null;
  }

  setBranchId(branchId) {
    const session = this.getSession() ?? {};
    this.setSession({
      ...session,
      branch_id: branchId
    });
  }

  addRequestGuard(guard) {
    if (typeof guard !== "function") {
      throw new ApiError("Request guard must be a function.");
    }

    this.requestGuards.push(guard);

    return () => {
      this.requestGuards = this.requestGuards.filter((item) => item !== guard);
    };
  }

  async runRequestGuards(context) {
    for (const guard of this.requestGuards) {
      const result = await guard(context);

      if (result === false) {
        throw new ApiError("Request blocked by API policy.");
      }
    }
  }

  async request(path, options = {}) {
    const normalizedPath = normalizePath(path);
    const method = (options.method || "GET").toUpperCase();
    const session = this.getSession();
    const url = appendQuery(new URL(`${this.baseUrl}${normalizedPath}`), options.query);
    const headers = new Headers(options.headers || {});
    const shouldAttachAuth = options.auth !== false;
    const hasBody = options.body !== undefined && options.body !== null;

    if (shouldAttachAuth && session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    if (session?.branch_id && !headers.has("X-Branch-Id")) {
      headers.set("X-Branch-Id", session.branch_id);
    }

    if (hasBody && isJsonBody(options.body) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const requestContext = {
      path: normalizedPath,
      url: url.toString(),
      method,
      headers,
      query: options.query,
      body: options.body,
      auth: shouldAttachAuth
    };

    await this.runRequestGuards(requestContext);

    const init = {
      method,
      headers,
      signal: options.signal
    };

    if (hasBody) {
      init.body = isJsonBody(options.body) ? JSON.stringify(options.body) : options.body;
    }

    const response = await fetch(url, init);

    if (
      response.status === 401 &&
      shouldAttachAuth &&
      options.skipAuthRefresh !== true &&
      normalizedPath !== "/access/refresh"
    ) {
      const refreshed = await this.refreshSession();

      if (refreshed) {
        return this.request(normalizedPath, {
          ...options,
          skipAuthRefresh: true
        });
      }
    }

    return this.parseResponse(response);
  }

  get(path, options) {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path, body, options) {
    return this.request(path, { ...options, method: "POST", body });
  }

  patch(path, body, options) {
    return this.request(path, { ...options, method: "PATCH", body });
  }

  put(path, body, options) {
    return this.request(path, { ...options, method: "PUT", body });
  }

  delete(path, options) {
    return this.request(path, { ...options, method: "DELETE" });
  }

  async parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new ApiError(
        typeof data === "object" && data?.message ? data.message : "API request failed.",
        {
          status: response.status,
          details: typeof data === "object" ? data?.details : undefined,
          data
        }
      );
    }

    return typeof data === "object" && data?.ok === true && "data" in data ? data.data : data;
  }

  async login({ identifier, password, branch_id }) {
    const data = await this.post(
      "/access/login",
      { identifier, password, branch_id },
      { auth: false }
    );

    this.setSession(data);
    return data;
  }

  async refreshSession() {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearSession();
      return null;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.post(
        "/access/refresh",
        {
          refresh_token: refreshToken,
          branch_id: this.getSession()?.branch_id
        },
        {
          auth: false,
          skipAuthRefresh: true
        }
      )
        .then((data) => {
          this.setSession({
            ...this.getSession(),
            ...data
          });
          return data;
        })
        .catch((error) => {
          this.clearSession();
          throw error;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();

    if (refreshToken) {
      await this.post(
        "/access/logout",
        { refresh_token: refreshToken },
        {
          auth: false,
          skipAuthRefresh: true
        }
      );
    }

    this.clearSession();
  }
}

export const apiClient = new ApiClient();
