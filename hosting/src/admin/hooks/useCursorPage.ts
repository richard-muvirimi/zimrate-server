import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as limitTo,
  limitToLast,
  onSnapshot,
  query,
  startAfter,
} from 'firebase/firestore';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useUrlPage } from './useUrlPage';

export interface CursorPageOptions<T> {
  /** Firestore collection path, e.g. 'rates'. */
  path: string;
  /** where()/orderBy() constraints, ending in a unique order. Rebuilt every render — see resetKey. */
  constraints: QueryConstraint[];
  /**
   * Serialised identity of the current filters. Required because `constraints` is
   * a new array each render and so cannot be an effect dependency without looping.
   * The filters themselves live in the URL, whose change already drops the page.
   */
  resetKey: string;
  perPage: number;
  map: (doc: QueryDocumentSnapshot<DocumentData>) => T;
  /** Hold off querying until the page size is known. */
  enabled?: boolean;
  /** Run one count query per resetKey to show "of N". */
  withTotal?: boolean;
  /** Follow the page's documents as they change, rather than reading them once. */
  live?: boolean;
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

interface Fetched<T> {
  stamp: string;
  rows: T[];
  /** The page actually shown: 1 when the URL's cursor no longer exists. */
  page: number;
  hasNext: boolean;
  firstId: string | null;
  lastId: string | null;
  error: string;
}

/**
 * Cursor pagination over a Firestore collection, reading only the rows shown.
 *
 * The position is in the URL (see useUrlPage): Next puts the id of the page's last
 * document in `after`, Prev the id of its first in `before`, read back with
 * endBefore/limitToLast. Opening such a link costs one extra read for that
 * document — never a walk through the pages before it. Whether a next page exists
 * is known by fetching perPage + 1 rows and trimming, which avoids a count query
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
  live = false,
}: CursorPageOptions<T>): PageResult<T> {
  const { page: urlPage, after, before, goTo } = useUrlPage();
  const [fetched, setFetched] = useState<Fetched<T> | null>(null);
  const [tick, setTick] = useState(0);
  const [totalState, setTotalState] = useState<{ key: string; value: number | null; error: string }>({
    key: resetKey,
    value: null,
    error: '',
  });

  const current = `${resetKey}|${perPage}|${after}|${before}|${tick}`;
  const fresh = fetched !== null && fetched.stamp === current;

  // A stale total belongs to the previous filter, so treat it as unknown.
  const total = totalState.key === resetKey ? totalState.value : null;
  const totalError = totalState.key === resetKey ? totalState.error : '';

  // The shown page's first and last documents. Following Prev or Next from them
  // needs no read to resolve the cursor.
  const edges = useRef<DocumentSnapshot[]>([]);

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
    const stamp = `${resetKey}|${perPage}|${after}|${before}|${tick}`;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const fail = (e: unknown) => {
      if (reqId.current !== id) return;
      // A missing composite index surfaces here, not at build time.
      setFetched({
        stamp, rows: [], page: 1, hasNext: false, firstId: null, lastId: null,
        error: e instanceof Error ? e.message : String(e),
      });
    };

    const resolveCursor = async (cursorId: string | null): Promise<DocumentSnapshot | null> => {
      if (!cursorId) return null;
      const known = edges.current.find((d) => d.id === cursorId);
      if (known) return known;
      // Hand-edited URL: a slash would address some other document.
      if (cursorId.includes('/')) return null;
      const snap = await getDoc(doc(db, path, cursorId));
      return snap.exists() ? snap : null;
    };

    resolveCursor(after ?? before)
      .then((cursor) => {
        if (cancelled) return;
        const backward = cursor !== null && !after;
        const parts = [...constraintsRef.current];
        if (backward) parts.push(endBefore(cursor), limitToLast(perPage));
        else {
          if (cursor) parts.push(startAfter(cursor));
          parts.push(limitTo(perPage + 1));
        }
        const q = query(collection(db, path), ...parts);

        const take = (snap: QuerySnapshot<DocumentData>) => {
          if (reqId.current !== id) return;
          // Coming back from a later page, there is a next one by definition.
          const more = !backward && snap.size > perPage;
          const docs = more ? snap.docs.slice(0, perPage) : snap.docs;
          edges.current = docs.length > 0 ? [docs[0], docs[docs.length - 1]] : [];
          setFetched({
            stamp,
            rows: docs.map((d) => mapRef.current(d)),
            page: cursor ? urlPage : 1,
            hasNext: backward || more,
            firstId: docs[0]?.id ?? null,
            lastId: docs[docs.length - 1]?.id ?? null,
            error: '',
          });
        };

        if (live) stop = onSnapshot(q, take, fail);
        else getDocs(q).then(take).catch(fail);
      })
      .catch(fail);

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [path, resetKey, perPage, after, before, urlPage, tick, enabled, live]);

  // One count per filter change, not per page.
  useEffect(() => {
    if (!enabled || !withTotal) return;
    let active = true;
    getCountFromServer(query(collection(db, path), ...constraintsRef.current))
      .then((snap) => {
        if (active) setTotalState({ key: resetKey, value: snap.data().count, error: '' });
      })
      .catch((e) => {
        if (active) setTotalState({ key: resetKey, value: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      active = false;
    };
  }, [path, resetKey, enabled, withTotal]);

  const dropLocal = useCallback(
    (predicate: (row: T) => boolean) =>
      setFetched((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => !predicate(r)) } : prev)),
    [],
  );

  // Keep the previous page's rows visible while the next one loads.
  const rows = fetched?.rows ?? [];
  const page = fresh ? fetched.page : urlPage;
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = rows.length === 0 ? 0 : rangeStart + rows.length - 1;
  const firstId = fresh ? fetched.firstId : null;
  const lastId = fresh ? fetched.lastId : null;

  return {
    rows,
    loading: enabled && !fresh,
    error: (fresh ? fetched.error : '') || totalError,
    page,
    hasPrev: page > 1,
    hasNext: fresh ? fetched.hasNext : false,
    rangeStart,
    rangeEnd,
    total,
    first: useCallback(() => goTo(1), [goTo]),
    // Page 1 is the bare URL, which also picks up anything added at the top since.
    prev: useCallback(
      () => goTo(page - 1, page > 2 && firstId ? { before: firstId } : undefined),
      [goTo, page, firstId],
    ),
    next: useCallback(() => {
      if (lastId) goTo(page + 1, { after: lastId });
    }, [goTo, page, lastId]),
    reload: useCallback(() => setTick((t) => t + 1), []),
    dropLocal,
  };
}

export default useCursorPage;
