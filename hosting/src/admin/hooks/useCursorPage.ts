import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  getCountFromServer,
  getDocs,
  limit as limitTo,
  query,
  startAfter,
} from 'firebase/firestore';
import type {
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';

export interface CursorPageOptions<T> {
  /** Firestore collection path, e.g. 'rates'. */
  path: string;
  /** where()/orderBy() constraints. Rebuilt every render — see resetKey. */
  constraints: QueryConstraint[];
  /**
   * Serialised identity of the current filters. Changing it resets to page 1.
   * Required because `constraints` is a new array each render and so cannot be
   * an effect dependency without looping.
   */
  resetKey: string;
  perPage: number;
  map: (doc: QueryDocumentSnapshot<DocumentData>) => T;
  /** Hold off querying until the page size is known. */
  enabled?: boolean;
  /** Run one count query per resetKey to show "of N". */
  withTotal?: boolean;
}

export interface PageResult<T> {
  rows: T[];
  loading: boolean;
  error: string;
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  rangeStart: number;
  rangeEnd: number;
  total: number | null;
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

const stamp = (p: Position) => `${p.key}|${p.perPage}|${p.page}|${p.tick}`;

/**
 * Cursor pagination over a Firestore collection.
 *
 * Keeps a stack of page-boundary snapshots so `previous` and `first` are free —
 * no backwards query, no endBefore/limitToLast. Whether a next page exists is
 * known by fetching perPage + 1 rows and trimming, which avoids a count query
 * per page.
 *
 * `loading` is derived by comparing the last fetched position with the current
 * one, rather than stored — which also means the previous page's rows stay on
 * screen while the next loads instead of the table blanking.
 */
export function useCursorPage<T>({
  path,
  constraints,
  resetKey,
  perPage,
  map,
  enabled = true,
  withTotal = false,
}: CursorPageOptions<T>): PageResult<T> {
  const [fetched, setFetched] = useState<Fetched<T> | null>(null);
  const [totalState, setTotalState] = useState<{ key: string; value: number | null }>({
    key: resetKey,
    value: null,
  });
  const [stored, setStored] = useState<Position>({ key: resetKey, perPage, page: 1, tick: 0 });

  // Reconciled during render rather than reset in an effect, so a filter change
  // lands on the same paint instead of triggering a cascading re-render.
  const pos: Position =
    stored.key === resetKey && stored.perPage === perPage
      ? stored
      : { key: resetKey, perPage, page: 1, tick: 0 };

  const { page, tick } = pos;
  const current = stamp(pos);
  const fresh = fetched !== null && stamp(fetched) === current;

  // A stale total belongs to the previous filter, so treat it as unknown.
  const total = totalState.key === resetKey ? totalState.value : null;

  // stack[n] is the last document of page n, used as the cursor for page n+1.
  // Never cleared: page always resets to 1 on a filter change, and each entry
  // is rewritten as that page loads, so a stale cursor is never read.
  const stack = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  // Held in refs so the fetch effect can use them without depending on a fresh
  // array/function identity every render. Synced in an effect rather than
  // during render — mutating a ref while rendering is not allowed.
  const constraintsRef = useRef(constraints);
  const mapRef = useRef(map);
  useEffect(() => {
    constraintsRef.current = constraints;
    mapRef.current = map;
  });

  // Guards against a slow earlier response overwriting a newer one — matters
  // under StrictMode's double-invoked effects.
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const id = ++reqId.current;
    const at: Position = { key: resetKey, perPage, page, tick };

    const cursor = page > 1 ? stack.current[page - 1] : undefined;
    const parts = [...constraintsRef.current];
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limitTo(perPage + 1));

    getDocs(query(collection(db, path), ...parts))
      .then((snap) => {
        if (reqId.current !== id) return;

        const more = snap.size > perPage;
        const docs = more ? snap.docs.slice(0, perPage) : snap.docs;
        if (docs.length > 0) stack.current[page] = docs[docs.length - 1];

        setFetched({ ...at, rows: docs.map((d) => mapRef.current(d)), hasNext: more, error: '' });
      })
      .catch((e) => {
        if (reqId.current !== id) return;
        // A missing composite index surfaces here, not at build time.
        setFetched({
          ...at,
          rows: [],
          hasNext: false,
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, [path, resetKey, perPage, page, tick, enabled]);

  // One count per filter change, not per page.
  useEffect(() => {
    if (!enabled || !withTotal) return;
    let active = true;
    getCountFromServer(query(collection(db, path), ...constraintsRef.current))
      .then((snap) => {
        if (active) setTotalState({ key: resetKey, value: snap.data().count });
      })
      .catch(() => {
        if (active) setTotalState({ key: resetKey, value: null });
      });
    return () => {
      active = false;
    };
  }, [path, resetKey, enabled, withTotal]);

  const move = useCallback(
    (fn: (p: Position) => Partial<Position>) =>
      setStored((prev) => {
        const base: Position =
          prev.key === resetKey && prev.perPage === perPage
            ? prev
            : { key: resetKey, perPage, page: 1, tick: 0 };
        return { ...base, ...fn(base) };
      }),
    [resetKey, perPage],
  );

  const dropLocal = useCallback(
    (predicate: (row: T) => boolean) =>
      setFetched((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => !predicate(r)) } : prev)),
    [],
  );

  // Keep the previous page's rows visible while the next one loads.
  const rows = fetched?.rows ?? [];
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = rows.length === 0 ? 0 : rangeStart + rows.length - 1;

  return {
    rows,
    loading: enabled && !fresh,
    error: fresh ? fetched.error : '',
    page,
    hasPrev: page > 1,
    hasNext: fresh ? fetched.hasNext : false,
    rangeStart,
    rangeEnd,
    total,
    first: useCallback(() => move(() => ({ page: 1 })), [move]),
    prev: useCallback(() => move((p) => ({ page: Math.max(1, p.page - 1) })), [move]),
    next: useCallback(() => move((p) => ({ page: p.page + 1 })), [move]),
    reload: useCallback(() => move((p) => ({ tick: p.tick + 1 })), [move]),
    dropLocal,
  };
}

export default useCursorPage;
