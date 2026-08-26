import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MAX_FRAMES = 60;

/**
 * React Router v7 does not scroll to hash targets and preserves scroll offset
 * across client navigations. This restores both behaviours.
 *
 * Hash targets are retried across frames because sections like #rates only
 * exist once their GraphQL query resolves — a single lookup at navigation time
 * would miss them.
 */
export default function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

    if (!hash) {
      window.scrollTo({ top: 0, behavior });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    let frame = 0;
    let raf = 0;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        // scroll-padding-top on <html> keeps the target clear of the sticky AppBar.
        el.scrollIntoView({ behavior, block: 'start' });
        return;
      }
      if (frame++ < MAX_FRAMES) raf = requestAnimationFrame(tryScroll);
    };

    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
    // `key` changes even when navigating to the identical location, so clicking
    // the same hash link twice re-scrolls.
  }, [pathname, hash, key]);

  return null;
}
