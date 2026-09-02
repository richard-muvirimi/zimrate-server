/**
 * True when the app is running as an installed app rather than in a browser tab.
 *
 * `navigator.standalone` is Safari's own flag and the only one iOS sets; the
 * media query covers every other engine.
 */
export function isStandalone(): boolean {
  return (
    ('standalone' in navigator && navigator.standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}
