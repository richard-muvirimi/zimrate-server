import { useCallback, useState } from 'react';

/**
 * Ticked rows for a list page's bulk actions.
 *
 * Only ids among `selectable` count as selected, so after a page turn or a
 * filter change a bulk action can never reach rows the admin no longer sees.
 */
export function useSelection(selectable: string[]) {
  const [ticked, setTicked] = useState<string[]>([]);
  const selected = ticked.filter((id) => selectable.includes(id));

  const toggle = useCallback((id: string) => {
    setTicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clear = useCallback(() => setTicked([]), []);

  const allTicked = selectable.length > 0 && selected.length === selectable.length;

  return {
    selected,
    isSelected: (id: string) => selected.includes(id),
    toggle,
    clear,
    /** For the header checkbox: tick every selectable row, or untick them all. */
    toggleAll: () => setTicked(allTicked ? [] : selectable),
    allTicked,
    someTicked: selected.length > 0 && !allTicked,
  };
}
