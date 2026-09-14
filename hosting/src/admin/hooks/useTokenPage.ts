import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '../adminFetch';

export interface TokenPageOptions {
  /** Admin API path, e.g. '/api/admin/app-users'. Query string is appended. */
  path: string;
  /**
   * Serialised identity of the current filters, sent as the request's query
   * string. Changing it resets to the first page.
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
  prev: () => void;
  next: () => void;
  reload: () => void;
  /** Remove a row locally after deleting it, without refetching the page. */
  dropLocal: (predicate: (row: T) => boolean) => void;
}

interface Position {
  key: string;
  perPage: number;
  page: number;
  tick: number;
}

interface Fetched<T> extends Position {
  rows: T[];
  hasNext: boolean;
  error: string;
}

interface Response<T> {
  users: T[];
  nextPageToken: string | null;
}

const stamp = (p: Position) => `${p.key}|${p.perPage}|${p.page}|${p.tick}`;

/**
 * Page through an admin endpoint that hands back an opaque `nextPageToken`.
 *
 * The sibling {@link useCursorPage} cannot be reused here: it pages Firestore
 * with `startAfter` on document snapshots, and these rows come from Firebase
 * Auth's `listUsers`, which only ever offers a forward token. Its structure is
 * borrowed wholesale though — position reconciled during render rather than
 * reset in an effect, and `loading` derived by comparing the last fetched
 * position with the current one rather than stored. Both avoid the cascading
 * renders that a setState inside an effect body causes, and the second also
 * keeps the previous page on screen while the next loads instead of blanking
 * the table.
 *
 * A forward-only token is also why there is no total and no jumping to page N —
 * the same shape `PaginationBar` already assumes, so it renders this unchanged.
 */
export function useTokenPage<T>({
  path,
  query = '',
  perPage,
  enabled = true,
}: TokenPageOptions): TokenPageResult<T> {
  const [fetched, setFetched] = useState<Fetched<T> | null>(null);
  const [stored, setStored] = useState<Position>({ key: query, perPage, page: 1, tick: 0 });

  const pos: Position =
    stored.key === query && stored.perPage === perPage
      ? stored
      : { key: query, perPage, page: 1, tick: 0 };

  const { page, tick } = pos;
  const fresh = fetched !== null && stamp(fetched) === stamp(pos);

  // tokens[n] fetches page n + 1. Page 1 needs none, so the stack starts empty
  // and gains an entry as each page loads. Never cleared: page always resets to
  // 1 on a filter change, so a stale token is never read.
  const tokens = useRef<string[]>([]);

  // Guards against a slow earlier response overwriting a newer one — matters
  // under StrictMode's double-invoked effects.
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const id = ++reqId.current;
    const at: Position = { key: query, perPage, page, tick };

    const params = new URLSearchParams(query);
    params.set('limit', String(perPage));
    const token = page > 1 ? tokens.current[page - 2] : undefined;
    if (token) params.set('pageToken', token);

    adminFetch<Response<T>>(`${path}?${params}`)
      .then((data) => {
        if (reqId.current !== id) return;

        if (data.nextPageToken) tokens.current[page - 1] = data.nextPageToken;
        setFetched({
          ...at,
          rows: data.users,
          hasNext: Boolean(data.nextPageToken),
          error: '',
        });
      })
      .catch((e) => {
        if (reqId.current !== id) return;
        setFetched({
          ...at,
          rows: [],
          hasNext: false,
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, [path, query, perPage, page, tick, enabled]);

  const move = useCallback(
    (fn: (p: Position) => Partial<Position>) =>
      setStored((prev) => {
        const base: Position =
          prev.key === query && prev.perPage === perPage
            ? prev
            : { key: query, perPage, page: 1, tick: 0 };
        return { ...base, ...fn(base) };
      }),
    [query, perPage],
  );

  // Keep the previous page's rows visible while the next one loads.
  const rows = fetched?.rows ?? [];
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * perPage + 1;

  return {
    rows,
    loading: enabled && !fresh,
    error: fresh ? fetched.error : '',
    page,
    hasPrev: page > 1,
    hasNext: fresh ? fetched.hasNext : false,
    rangeStart,
    rangeEnd: rows.length === 0 ? 0 : rangeStart + rows.length - 1,
    first: useCallback(() => move(() => ({ page: 1 })), [move]),
    prev: useCallback(() => move((p) => ({ page: Math.max(1, p.page - 1) })), [move]),
    next: useCallback(() => move((p) => ({ page: p.page + 1 })), [move]),
    reload: useCallback(() => move((p) => ({ tick: p.tick + 1 })), [move]),
    dropLocal: useCallback(
      (predicate: (row: T) => boolean) =>
        setFetched((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => !predicate(r)) } : prev)),
      [],
    ),
  };
}

export default useTokenPage;
