import type { ElementType } from 'react';
import Obfuscate from 'react-obfuscate';
import { Link } from '@mui/material';
import type { LinkProps } from '@mui/material';

// react-obfuscate types onClick as `() => void`, which does not line up with
// MUI Link's MouseEventHandler. The runtime contract is fine; only the
// declaration is narrower than React's.
const ObfuscateLink = Obfuscate as unknown as ElementType;

/**
 * Bot-resistant email link.
 *
 * The legacy site used the `safe-email` package, which cannot be reused here:
 * it only scans the DOM on DOMContentLoaded and self-guards with
 * `window.areEmailsInitialized`, so in a client-rendered SPA it runs before
 * React has mounted anything and never runs again on navigation. It also
 * exports nothing callable.
 *
 * `react-obfuscate` applies the same protection the React way:
 *  - the visible address is rendered reversed and flipped back with
 *    `direction: rtl; unicode-bidi: bidi-override`, so scraped text is backwards;
 *  - `href` stays a dummy value until real human interaction (focus, mouseover
 *    or right-click), so there is no harvestable mailto in the initial DOM;
 *  - the real address is only assembled at navigation time.
 *
 * Composed as `<Link component={Obfuscate}>` rather than
 * `<Obfuscate element={Link}>`: react-obfuscate only attaches its href and
 * click handler when the rendered element is the literal string "a", so passing
 * a component as `element` produces a dead link.
 */
interface SafeEmailProps extends Omit<LinkProps, 'href' | 'children'> {
  email: string;
  subject?: string;
  body?: string;
  /** Optional visible text. Defaults to the obfuscated address itself. */
  label?: string;
}

export default function SafeEmail({
  email,
  subject,
  body,
  label,
  ...linkProps
}: SafeEmailProps) {
  const headers: Record<string, string> = {};
  if (subject) headers.subject = subject;
  if (body) headers.body = body;

  return (
    <Link
      {...linkProps}
      component={ObfuscateLink}
      email={email}
      {...(Object.keys(headers).length ? { headers } : {})}
      // A custom label must not be reversed; the address itself must be.
      {...(label ? { obfuscateChildren: false, children: label } : {})}
    />
  );
}
