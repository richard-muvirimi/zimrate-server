import { auth, getAppCheckToken } from '../firebase';
import { API_BASE_URL } from '../config';

export class AdminApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.body = body;
  }
}

async function buildHeaders(idToken: string, init?: RequestInit): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;

  if (init?.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Caller headers last so they can override anything above.
  return { ...headers, ...(init?.headers as Record<string, string> | undefined) };
}

/**
 * Calls an /api/admin endpoint with a Firebase ID token and, when App Check is
 * configured, an App Check token.
 *
 * Lives under src/admin/ rather than src/ so that it — and transitively
 * firebase/auth and firebase/app-check — stays out of the landing page bundle.
 * Importing it from a public page would pull the Firebase SDK onto /.
 */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AdminApiError(401, 'Not signed in');

  const url = `${API_BASE_URL}${path}`;

  let res = await fetch(url, { ...init, headers: await buildHeaders(await user.getIdToken(), init) });

  // Retry once with a forced refresh — covers clock skew and expiry races.
  if (res.status === 401) {
    res = await fetch(url, {
      ...init,
      headers: await buildHeaders(await user.getIdToken(true), init),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    let message = text || `Request failed: ${res.status}`;
    try {
      body = JSON.parse(text);
      // Controllers and auth middleware use `error`; the 404/notFound handler
      // uses `message`. Accept either rather than falling through to raw JSON.
      const parsed = body as { error?: string; message?: string };
      if (parsed.error) message = parsed.error;
      else if (parsed.message) message = parsed.message;
    } catch {
      // Not JSON — keep the raw text as the message.
    }

    if (res.status === 404) {
      message = `${message} — this endpoint is not deployed yet. Run "firebase deploy --only functions".`;
    }
    throw new AdminApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
