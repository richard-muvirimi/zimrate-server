import { useEffect, useRef, useState } from 'react';

const hasObserver = () => typeof IntersectionObserver !== 'undefined';

/**
 * Fires once when the element first scrolls into view.
 *
 * MUI ships the transition components but no viewport trigger — useScrollTrigger
 * watches window scroll position, not element visibility — so this drives the
 * `in` prop of Fade / Grow / Slide.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(rootMargin = '0px 0px -80px 0px') {
  const ref = useRef<T>(null);
  // Without IntersectionObserver (older browsers, test environments) start
  // visible, so content is never left permanently hidden.
  const [inView, setInView] = useState(() => !hasObserver());

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasObserver()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

export default useInView;
