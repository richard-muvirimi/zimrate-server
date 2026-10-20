import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_PARAMS } from './useUrlPage';

/**
 * A list page's filters, kept in the URL so a reload or a shared link shows the
 * same list. Empty values are left out of the URL, and changes replace the history
 * entry rather than adding one.
 *
 * A change of value also drops the page position: a cursor from one result set
 * means nothing in another. Writing a value that is already set changes nothing.
 *
 * `defaults` is read once; pass a module constant.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
): [T, (updates: Partial<T>) => void, () => void] {
  const [params, setParams] = useSearchParams();
  const defaultsRef = useRef(defaults);

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = params.get(key);
      if (value !== null) (result as Record<string, string>)[key] = value;
    }
    return result;
    // `defaults` is read once, by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const setFilters = useCallback(
    (updates: Partial<T>) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        let changed = false;
        for (const [key, value] of Object.entries(updates)) {
          changed ||= (prev.get(key) ?? '') !== (value ?? '');
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (changed) PAGE_PARAMS.forEach((k) => next.delete(k));
        return next;
      }, { replace: true }),
    [setParams],
  );

  const clearFilters = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        [...Object.keys(defaultsRef.current), ...PAGE_PARAMS].forEach((k) => next.delete(k));
        return next;
      }, { replace: true }),
    [setParams],
  );

  return [filters, setFilters, clearFilters];
}

export default useUrlFilters;
