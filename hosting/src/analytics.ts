/**
 * Google Analytics 4 page tracking.
 *
 * The tag is loaded from index.html rather than through `firebase/analytics`:
 * importing the Firebase SDK here would pull it into the entry chunk and undo
 * the Firebase-free isolation the landing bundle depends on. An external async
 * script costs the bundle nothing.
 *
 * The inline snippet in index.html defines `gtag` synchronously and queues into
 * `dataLayer`, so calls made before (or without) the network script are simply
 * buffered rather than lost — including when an extension blocks the request.
 */

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/** Records one GA4 page_view for the current URL. */
export function trackPageView(title: string): void {
  window.gtag?.('event', 'page_view', {
    page_title: title,
    page_location: window.location.href,
  });
}
