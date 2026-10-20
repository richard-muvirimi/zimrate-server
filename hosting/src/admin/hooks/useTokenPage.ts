import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '../adminFetch';
import { useUrlPage } from './useUrlPage';

export interface TokenPageOptions {
  /** Admin API path, e.g. '/api/admin/app-users'. Query string is appended. */
  path: string;
  /**
   * Serialised identity of the current filters, sent as the request's query
   * string. The filters themselves live in the URL, whose change already drops
   * the page.
   */
  query?: string;
  perPage: number;
  /** Hold off requesting until the page size is known. */
  enabled?: boolean;
}

export interface TokenPageResult<T> {
  rows: T[];
  loading: boolean;
  error: string;
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  rangeStart: number;
  rangeEnd: number;
  first: () => void;
  next: () => void;
  reload: () => void;
  /** Remove a row locally after deleting it, without refetching the page. */
  dropLocal: (predicate: (row: T) => boolean) => void;
}

interface Fetched<T> {
  stamp: string;
  rows: T[];
  nextToken: string | null;
  error: string;
}

interface Response<T> {
  users: T[];
  nextPageToken: string | null;
}

/**
 * Page through an admin endpoint that hands back an opaque `nextPageToken`.
 *
 * The sibling {@link useCursorPage} cannot be reused here: it pages Firestore
 * with document cursors, and these rows come from Firebase Auth's `listUsers`,
 * which only ever offers a forward token. The position is in the URL all the
 * same (see useUrlPage) — the current page's token as `after` — so a reload or a
 * shared link opens the same page.
 *
 * Forward only, so there is no Previous: the URL holds one token, not the trail
 * that led to it. First goes back to the start, and the browser's Back steps back
 * a page. Nor is there a total or a jump to page N — the same shape
 * `PaginationBar` already assumes.
 */
export function useTokenPage<T>({
  path,
  query = '',
  perPage,
  enabled = true,
}: TokenPageOptions): TokenPageResult<T> {
  const { page, after: token, goTo } = useUrlPage();
  const [fetched, setFetched] = useState<Fetched<T> | null>(null);
  const [tick, setTick] = useState(0);

  const current = `${query}|${perPage}|${token}|${tick}`;
  const fresh = fetched !== null && fetched.stamp === current;

  // Guards against a slow earlier response overwriting a newer one — matters
  // under StrictMode's double-invoked effects.
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const id = ++reqId.current;
    const stamp = `${query}|${perPage}|${token}|${tick}`;

    const params = new URLSearchParams(query);
    params.set('limit', String(perPage));
    if (token) params.set('pageToken', token);

    adminFetch<Response<T>>(`${path}?${params}`)
      .then((data) => {
        if (reqId.current !== id) return;
        setFetched({ stamp, rows: data.users, nextToken: data.nextPageToken, error: '' });
      })
      .catch((e) => {
        if (reqId.current !== id) return;
        setFetched({ stamp, rows: [], nextToken: null, error: e instanceof Error ? e.message : String(e) });
      });
  }, [path, query, perPage, token, tick, enabled]);

  // Keep the previous page's rows visible while the next one loads.
  const rows = fetched?.rows ?? [];
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const nextToken = fresh ? fetched.nextToken : null;

  return {
    rows,
    loading: enabled && !fresh,
    error: fresh ? fetched.error : '',
    page,
    hasPrev: page > 1,
    hasNext: nextToken !== null,
    rangeStart,
    rangeEnd: rows.length === 0 ? 0 : rangeStart + rows.length - 1,
    first: useCallback(() => goTo(1), [goTo]),
    next: useCallback(() => {
      if (nextToken) goTo(page + 1, { after: nextToken });
    }, [goTo, page, nextToken]),
    reload: useCallback(() => setTick((t) => t + 1), []),
    dropLocal: useCallback(
      (predicate: (row: T) => boolean) =>
        setFetched((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => !predicate(r)) } : prev)),
      [],
    ),
  };
}

export default useTokenPage;
