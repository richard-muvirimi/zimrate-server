import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * A text filter typed freely but kept in the URL: what is typed is committed once
 * typing pauses, and a change to the URL made elsewhere — Clear all, a chip, the
 * Back button — replaces what is in the box.
 *
 * Returns the box's text and its setter.
 */
export function useUrlSearchInput(
  committed: string,
  commit: (value: string) => void,
  delay = 300,
): [string, (value: string) => void] {
  const [draft, setDraft] = useState({ base: committed, text: committed });

  // Reconciled during render rather than reset in an effect, so the box follows
  // the URL on the same paint.
  const text = draft.base === committed ? draft.text : committed;
  const debounced = useDebouncedValue(text, delay);

  useEffect(() => {
    // Only what is still in the box: a stale value would undo a change made elsewhere.
    if (debounced === text && debounced !== committed) commit(debounced);
  }, [debounced, text, committed, commit]);

  return [text, (value: string) => setDraft({ base: committed, text: value })];
}

export default useUrlSearchInput;
