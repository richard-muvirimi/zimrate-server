import { useCallback, useMemo, useState } from 'react';
import type { PageResult } from './useCursorPage';

interface State<T> {
  key: string;
  page: number;
  dropped: T[];
}

/**
 * Client-side paging over an already-loaded array, exposing the same shape as
 * useCursorPage so both can drive the same pagination bar.
 *
 * Used for Sources and Users: both are tens of rows, and Sources deliberately
 * avoids Firestore orderBy because it silently drops documents missing the
 * sort field.
 */
export function useArrayPage<T>(
  items: T[],
  perPage: number,
  resetKey: string,
): PageResult<T> {
  const [stored, setStored] = useState<State<T>>({ key: resetKey, page: 1, dropped: [] });

  // Reconciled during render rather than reset in an effect: a filter change
  // takes effect on the same paint, with no cascading re-render.
  const state: State<T> =
    stored.key === resetKey ? stored : { key: resetKey, page: 1, dropped: [] };

  const setPage = useCallback(
    (fn: (p: number) => number) =>
      setStored((prev) => {
        const base = prev.key === resetKey ? prev : { key: resetKey, page: 1, dropped: [] as T[] };
        return { ...base, page: fn(base.page) };
      }),
    [resetKey],
  );

  const visible = useMemo(
    () => items.filter((i) => !state.dropped.includes(i)),
    [items, state.dropped],
  );

  const total = visible.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  // Deleting the last row of the final page would otherwise strand the view.
  const safePage = Math.min(state.page, pageCount);
  const start = (safePage - 1) * perPage;
  const rows = visible.slice(start, start + perPage);

  const dropLocal = useCallback(
    (predicate: (row: T) => boolean) =>
      setStored((prev) => {
        const base = prev.key === resetKey ? prev : { key: resetKey, page: 1, dropped: [] as T[] };
        return { ...base, dropped: [...base.dropped, ...items.filter(predicate)] };
      }),
    [items, resetKey],
  );

  const reload = useCallback(
    () => setStored({ key: resetKey, page: 1, dropped: [] }),
    [resetKey],
  );

  return {
    rows,
    loading: false,
    error: '',
    page: safePage,
    hasPrev: safePage > 1,
    hasNext: safePage < pageCount,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: total === 0 ? 0 : start + rows.length,
    total,
    first: useCallback(() => setPage(() => 1), [setPage]),
    prev: useCallback(() => setPage((p) => Math.max(1, p - 1)), [setPage]),
    next: useCallback(() => setPage((p) => p + 1), [setPage]),
    reload,
    dropLocal,
  };
}

export default useArrayPage;
