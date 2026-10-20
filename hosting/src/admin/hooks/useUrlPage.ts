import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Where a paged list is up to. A filter change drops these — see useUrlFilters. */
export const PAGE_PARAMS = ['page', 'after', 'before'];

/** Start after this cursor, or end before it. */
export type PageCursor = { after: string } | { before: string };

/**
 * The position of a paged list, read from and written to the URL — the only place
 * it is kept, so a reload or a shared link opens the same page. Both pagers go
 * through here: useCursorPage for Firestore, useTokenPage for the admin API.
 *
 * `after` and `before` are cursors the data source understands. `page` is only the
 * number shown and means nothing without one, so a URL with no cursor is page 1.
 * Page turns are history entries, so the browser's Back steps back a page.
 */
export function useUrlPage() {
  const [params, setParams] = useSearchParams();
  const after = params.get('after');
  const before = params.get('before');
  const page = after || before ? Math.max(2, Number.parseInt(params.get('page') ?? '', 10) || 2) : 1;

  /** Page 1, or any page without a cursor, is the bare URL. */
  const goTo = useCallback(
    (to: number, cursor?: PageCursor) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        PAGE_PARAMS.forEach((k) => next.delete(k));
        if (to > 1 && cursor) {
          next.set('page', String(to));
          Object.entries(cursor).forEach(([k, v]) => next.set(k, v));
        }
        return next;
      }),
    [setParams],
  );

  return { page, after, before, goTo };
}

export default useUrlPage;
