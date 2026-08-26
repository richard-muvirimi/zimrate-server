import { useEffect, useState } from 'react';
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_KEY,
  PER_PAGE_STORAGE_KEY,
  loadOptionValues,
  parsePerPage,
} from '../options';

function cached(): number | null {
  try {
    const raw = localStorage.getItem(PER_PAGE_STORAGE_KEY);
    return raw ? parsePerPage(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Rows per page, from the `admin_per_page` option.
 *
 * Seeded synchronously from a localStorage mirror so the first query already
 * uses the right limit instead of fetching once at the default and again at the
 * real value. Firestore then revalidates it.
 *
 * `ready` is false only on a cold first visit with no mirror — callers use it to
 * hold off querying rather than paging at the wrong size.
 */
export function usePerPage(): { perPage: number; ready: boolean } {
  const initial = cached();
  const [perPage, setPerPage] = useState(initial ?? DEFAULT_PER_PAGE);
  const [ready, setReady] = useState(initial !== null);

  useEffect(() => {
    let active = true;
    loadOptionValues()
      .then((values) => {
        if (!active) return;
        const next = parsePerPage(values[PER_PAGE_KEY]);
        setPerPage(next);
        try {
          localStorage.setItem(PER_PAGE_STORAGE_KEY, String(next));
        } catch {
          // Private mode — fall back to re-reading Firestore next time.
        }
      })
      .catch(() => {
        // Options unreadable: the default is a safe page size.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { perPage, ready };
}

export default usePerPage;
