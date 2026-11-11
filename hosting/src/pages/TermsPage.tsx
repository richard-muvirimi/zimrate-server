import { Box, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PageHero from '../components/PageHero';
import SafeEmail from '../components/SafeEmail';
import { useBranding } from '../useBranding';
import SiteLayout from '../components/SiteLayout';

const sections = [
  {
    title: '1. Accepting these terms',
    body: [
      'These terms apply to the ZimRate website, the public rates API, the ZimRate Android app, the Wear OS companion app, and any other product published under the ZimRate name (together, "the service"). By using the service you agree to these terms. If you do not agree, do not use it.',
      'How information is collected and used is described separately in the Privacy Policy, which forms part of these terms.',
    ],
  },
  {
    title: '2. Rates are for information only',
    body: [
      'Exchange rates shown by the service are gathered from third-party sources and published as received. They may be delayed, incomplete or wrong, and they are not an offer to buy or sell currency at any price.',
      'Nothing in the service is financial, investment, legal or tax advice. Check rates with the institution you are dealing with before making any transaction, and do not rely on the service as your only source.',
    ],
  },
  {
    title: '3. Your account',
    body: [
      'The app creates an anonymous account the first time you open it. You may optionally sign in with an email address or a Google account to keep your account across devices. You are responsible for keeping access to that sign-in method secure.',
      'An anonymous account that has not been linked to a sign-in can be lost if you uninstall the app, clear its data or change devices, and anything stored against it — including coins — cannot then be recovered.',
      'You can delete your account at any time, as described in the Privacy Policy.',
    ],
  },
  {
    title: '4. Coins and purchases',
    body: [
      'The app offers coins, a virtual item that can be earned (for example by watching a rewarded ad) or bought through Google Play, and spent on features within the app. Coins have no cash value, cannot be exchanged for money, and cannot be transferred, sold or traded between accounts.',
      'Coins may carry an expiry date, which is shown in the app. Expired coins, and coins remaining when an account is deleted, are forfeited.',
      'Purchases are processed by Google Play under its own terms. Refunds and billing disputes are handled through Google Play, except where the law where you live gives you rights that cannot be excluded.',
      'Prices, the features coins unlock, and how coins are earned may change. Changes do not take away coins already in your account before their expiry date.',
    ],
  },
  {
    title: '5. Advertising',
    body: [
      'Parts of the service are supported by advertising from third-party networks. Those advertisers are responsible for their own ads, and any dealings you have with them are between you and them.',
    ],
  },
  {
    title: '6. Using the API',
    body: [
      'The public API is free and does not require a key. You may use it in your own websites, apps and tools, including commercial ones.',
      'Use it reasonably: cache responses where practical, and do not send traffic intended to overload, disrupt or degrade the service for others. Access may be throttled or blocked for clients that do.',
      'Do not present data from the API as your own original data, or suggest that ZimRate endorses your product.',
    ],
  },
  {
    title: '7. Acceptable use',
    body: [
      'You agree not to: break the law using the service; try to gain access to accounts, systems or data that are not yours; interfere with the service or its security checks; reverse engineer the app to obtain coins or features without paying for them; or use automated tools against the app or website other than through the public API.',
      'Accounts used in breach of these terms may be suspended or deleted.',
    ],
  },
  {
    title: '8. Intellectual property',
    body: [
      'The ZimRate name, logo, app and website design belong to their owner. Where source code is published under an open-source licence, that licence governs its use. Exchange rate figures belong to their original sources.',
    ],
  },
  {
    title: '9. Availability and changes to the service',
    body: [
      'The service is provided as it is, when it is available. Features may be added, changed or removed, and the service may be interrupted or discontinued, at any time and without notice.',
    ],
  },
  {
    title: '10. No warranty and limitation of liability',
    body: [
      'To the fullest extent permitted by law, the service is provided without warranties of any kind, whether express or implied, including any warranty of accuracy, fitness for a particular purpose, or uninterrupted availability.',
      'To the fullest extent permitted by law, ZimRate and its developer are not liable for any loss or damage arising from your use of, or inability to use, the service — including losses from relying on rates it shows. Where liability cannot be excluded, it is limited to the amount you paid for coins in the twelve months before the claim.',
      'Nothing in these terms limits rights you have under consumer protection law that cannot be excluded by agreement.',
    ],
  },
  {
    title: '11. Ending your use',
    body: [
      'You can stop using the service at any time, and delete your account as described in the Privacy Policy. We may suspend or end access to the service for anyone who breaches these terms.',
    ],
  },
  {
    title: '12. Changes and contact',
    body: [
      'These terms may be updated from time to time. Changes take effect when they are published here, and the date above shows when that last happened. Continuing to use the service after a change means you accept the updated terms. Questions can be sent by email.',
    ],
  },
];

export default function TermsPage() {
  const branding = useBranding();

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Policy"
        title="Terms of Service"
        description="The rules for using the website, the API and the apps."
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Last updated November 11, 2026
          </Typography>

          <Stack spacing={3}>
            <Box
              sx={{
                p: 3,
                border: '1px solid', borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Typography color="text.secondary" paragraph>
                ZimRate is free to use. Rates are for information only and may be wrong, so check before you transact. Coins are a virtual item with no cash value. Use the API fairly. How your information is handled is covered in the{' '}
                <Link component={RouterLink} to="/privacy" underline="hover">Privacy Policy</Link>.
              </Typography>
              {branding.author_email && (
                <Typography color="text.secondary">
                  If you have questions about these terms, contact{' '}
                  <SafeEmail email={branding.author_email} underline="hover" />
                  .
                </Typography>
              )}
            </Box>

            {sections.map((section) => (
              <Box
                key={section.title}
                sx={{
                  p: 3,
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="h5" gutterBottom>
                  {section.title}
                </Typography>
                <Stack spacing={2}>
                  {section.body.map((paragraph) => (
                    <Typography key={paragraph} color="text.secondary">
                      {paragraph}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </SiteLayout>
  );
}
