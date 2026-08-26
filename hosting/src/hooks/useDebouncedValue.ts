import { useEffect, useState } from 'react';

/**
 * Delays propagating a rapidly-changing value.
 *
 * The filter inputs feed straight into Firestore queries, so without this every
 * keystroke would be a round trip.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
