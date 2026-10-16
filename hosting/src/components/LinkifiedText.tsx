import type { ReactNode } from 'react';
import Linkify from 'linkify-react';
import type { Opts } from 'linkifyjs';
import { Link } from '@mui/material';

/**
 * Firebase errors carry their fix as a bare console URL (e.g. "You can create
 * it here: https://console.firebase.google.com/…/firestore/indexes?create_composite=…").
 * Those run to hundreds of characters, so they get a label saying what the link does.
 */
function label(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.hostname === 'console.firebase.google.com') {
    if (url.searchParams.has('create_exemption')) return 'Create index exemption';
    if (url.pathname.includes('/firestore/indexes')) return 'Create index';
    return 'Open Firebase console';
  }
  if (url.hostname === 'console.cloud.google.com' || url.hostname === 'console.developers.google.com') {
    if (url.pathname.startsWith('/apis/')) return 'Enable API';
    return 'Open Google Cloud console';
  }
  return href;
}

const options: Opts = {
  // Only explicit http(s) URLs: error text also names hosts like
  // "firestore.googleapis.com" and email addresses, which aren't meant as links.
  validate: (value, type) => type === 'url' && /^https?:\/\//i.test(value),
  format: (value) => label(value),
  render: ({ attributes, content }) => (
    <Link {...attributes} target="_blank" rel="noopener noreferrer" color="inherit" fontWeight={600}>
      {content}
    </Link>
  ),
};

/** Renders error text with any URLs in it as clickable, labelled links. */
export default function LinkifiedText({ children }: { children: ReactNode }) {
  return <Linkify options={options}>{children}</Linkify>;
}
