// Small wrapper to route API calls to the main process when the app is
// running inside the Electron production build (app:// protocol). In
// development it uses the normal fetch() to hit Next.js API routes.
export type ApiResponse<T = any> = { ok: boolean; data?: T; error?: string };

export async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<ApiResponse<T>> {
  // Normalize path: ensure it starts with /api
  const urlPath = path.startsWith('/') ? path : `/${path}`;

  // Determine if we are running inside the packaged app (app://) or in dev (http/https)
  const isAppProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'app:';

  if (isAppProtocol && (window as any).ipc && typeof (window as any).ipc.invoke === 'function') {
    // Route to main via IPC
    try {
      const method = (opts && opts.method) || 'GET';
      let body: any = undefined;
      if (opts && opts.body) {
        // If body is a string, try to parse as JSON; otherwise pass through
        try {
          body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
        } catch (e) {
          body = opts.body;
        }
      }
      const headers: Record<string, string> = {};
      if (opts && opts.headers) {
        // Normalise HeadersInit
        if (opts.headers instanceof Headers) {
          opts.headers.forEach((v: string, k: string) => (headers[k] = v));
        } else if (Array.isArray(opts.headers)) {
          (opts.headers as Array<[string, string]>).forEach(([k, v]) => (headers[k] = v));
        } else {
          Object.assign(headers, opts.headers as Record<string, string>);
        }
      }

      // Call the main handler
      const res = await (window as any).ipc.invoke('api:call', { path: urlPath, method, body, headers });
      return res as ApiResponse<T>;
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  // Fallback: use fetch (development / non-electron context)
  try {
    const res = await fetch(urlPath, opts);
    // Attempt to parse json; if fails return ok:false
    try {
      const json = await res.json();
      // If server returns {ok:true,data:...} keep it, otherwise wrap
      if (json && typeof json === 'object' && ('ok' in json)) return json as ApiResponse<T>;
      return { ok: res.ok, data: json } as ApiResponse<T>;
    } catch (err) {
      return { ok: res.ok, data: undefined as any };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export default apiFetch;
export type ApiOptions = {
  method?: string;
  body?: any;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function apiCall<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method || 'GET';
  const isElectron = typeof (window as any).ipc?.invoke === 'function';

  if (isElectron) {
    // Producción: usa IPC
    const resp = await (window as any).ipc.invoke('api:call', {
      path,
      method,
      body: opts.body ?? null,
      headers: opts.headers ?? {},
    });
    if (!resp || resp.ok === false) {
      const msg = resp?.error || 'Error interno';
      throw new Error(msg);
    }
    return resp.data as T;
  }

  // Desarrollo: usa fetch contra Next API
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
