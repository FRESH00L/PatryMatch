'use client';

import { sessionKeyFor, SESSION_HEADER } from '@/lib/shared';

export { SESSION_HEADER, sessionKeyFor };

export function readSession(partyCode: string): string | null {
  try {
    return window.localStorage.getItem(sessionKeyFor(partyCode));
  } catch {
    return null; // private mode / storage disabled
  }
}

export function writeSession(partyCode: string, token: string): void {
  try {
    window.localStorage.setItem(sessionKeyFor(partyCode), token);
  } catch {
    /* non-fatal: the user simply has to set up again on reload */
  }
}

export function clearSession(partyCode: string): void {
  try {
    window.localStorage.removeItem(sessionKeyFor(partyCode));
  } catch {
    /* ignore */
  }
}

/** fetch() with the session header attached, throwing readable API errors. */
export async function api<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set(SESSION_HEADER, token);

  const res = await fetch(path, { ...init, headers, cache: 'no-store' });
  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(
      (payload as { error?: string } | null)?.error ?? `Błąd ${res.status}`,
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return payload as T;
}
