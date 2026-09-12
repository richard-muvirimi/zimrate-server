import { Box, Stack, Typography } from '@mui/material';
import PageHero from '../components/PageHero';
import SafeEmail from '../components/SafeEmail';
import { useBranding } from '../useBranding';
import SiteLayout from '../components/SiteLayout';

const sections = [
  {
    title: '1. What this policy covers',
    body: [
      'This policy applies to the ZimRate website, the public rates API, the ZimRate Android app, and the Wear OS companion app. The app sections below describe what the app collects on your device; the website sections describe what happens when you browse the site or call the API.',
      'We do not sell personal information, and we do not build advertising profiles ourselves.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'The app signs you in anonymously the first time you open it. That creates an account identifier used to store your coins and your currency setup, and it is not linked to you personally.',
      'If you choose to sign in — to protect coins you have bought, or to carry them to a new phone — we also store the email address you sign in with, or the email address and display name attached to the Google account you choose. Sign-in is handled by Firebase Authentication; we never see or store your password.',
    ],
  },
  {
    title: '3. What the app stores against your account',
    body: [
      'Coin grants and their balances, including how each grant was earned or bought and when it expires; a record of what you have spent coins on; and the currencies and rates you have added, pinned or hidden, so your setup follows you between devices.',
      'This is held in Firebase Realtime Database and is readable only by the account it belongs to. Coin history is deleted automatically six months after a grant expires.',
    ],
  },
  {
    title: '4. Diagnostics, analytics and app integrity',
    body: [
      'The app uses Firebase Crashlytics for crash reports, Google Analytics for Firebase for usage measurement, and Firebase Remote Config for feature settings. These collect device and app information such as device model, operating system version, app version, language, a randomly generated instance identifier, and what you tapped or viewed in the app.',
      'Analytics can be switched off in the app under Settings. Crash reporting is retained because it is how faults get fixed.',
      'The app uses Firebase App Check with Google Play Integrity, and the website uses reCAPTCHA, to confirm that requests to our API come from the genuine app or site rather than from an automated tool. Google may collect hardware and software information for this check.',
    ],
  },
  {
    title: '5. Advertising',
    body: [
      'The app shows banner, interstitial and rewarded ads through Appodeal, which mediates a number of advertising networks. These partners may access your device advertising ID and information about the device in order to select and measure ads. The app declares the Android advertising ID permission for this reason.',
      'You can reset or delete your advertising ID, and opt out of ad personalisation, in your Android settings under Privacy. Appodeal publishes its own privacy policy and the current list of its advertising partners, and where the law requires consent, its consent form is shown before personalised ads are used.',
      'Buying coins removes ads.',
    ],
  },
  {
    title: '6. Purchases',
    body: [
      'Coin purchases are processed by Google Play Billing. Payment details are handled entirely by Google — we never receive your card or bank information. What reaches us is a purchase token, which we record against your account so the coins you paid for cannot be granted twice.',
      'Refunds and billing disputes are handled through Google Play.',
    ],
  },
  {
    title: '7. Website and API',
    body: [
      'Requests to the website and the public API are measured in aggregate. The identifier used for this is a salted, one-way hash of the network address and browser or client details; the raw address is never stored or sent on, and no account identifier is attached.',
      'If you use the contact form, the email address and message you enter are emailed to us so we can reply. The calculator on the website keeps your currency setup in your own browser storage; it does not leave your device.',
    ],
  },
  {
    title: '8. Deleting your account and data',
    body: [
      'In the app, open Settings, find the Account section, and choose Delete account. In a browser — including after you have uninstalled the app — go to the Delete account page on this site and sign in with the same account.',
      'Either route immediately and permanently removes your coins and coin history, your spending history, your saved and custom currencies, and your sign-in itself. It cannot be undone, and coins you have paid for are not refunded.',
      'If you only ever used the app without signing in and can no longer reach that account, use the contact form and we will remove it for you.',
      'Two things survive a deletion and are outside our control: Google keeps its own record of Play Store transactions, and aggregate analytics and crash reports that were never linked to your account remain in Google systems under their retention schedules.',
    ],
  },
  {
    title: '9. Retention and security',
    body: [
      'Account data is kept until you delete your account. Coin history is swept six months past expiry. Website and API telemetry is retained under the Google Analytics retention settings.',
      'Data is held in Google Cloud and Firebase infrastructure, and access is restricted to the account it belongs to and to project administrators. Reasonable technical and organisational safeguards are used, but no system can guarantee absolute security.',
    ],
  },
  {
    title: '10. Children',
    body: [
      'ZimRate is a currency tool intended for a general audience and is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has created an account, contact us and we will remove it.',
    ],
  },
  {
    title: '11. Your rights',
    body: [
      'You can access and correct what the app holds by opening it, control device permissions and your advertising ID through your operating system, switch analytics off in the app settings, and delete everything at any time using the routes in section 8.',
      'Depending on where you live you may have further rights over your personal information. Contact us and we will act on a request within thirty days.',
    ],
  },
  {
    title: '12. Changes and contact',
    body: [
      'Material changes to this policy will be reflected in the date above, and, where the change is significant, announced in the app. Questions or requests can be sent by email.',
    ],
  },
];

export default function PrivacyPage() {
  const branding = useBranding();

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Policy"
        title="Privacy Policy"
        description="What we collect, why we collect it, and how to get in touch about your information."
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Last updated September 12, 2026
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
                ZimRate is committed to protecting your personal information and your right to privacy. This policy covers the website, the public API, the Android app and its Wear OS companion, and names what each of them collects. You can delete your account and everything stored against it at any time — see section 8.
              </Typography>
              {branding.author_email && (
                <Typography color="text.secondary">
                  If you have questions or concerns about this policy or how information is handled, contact{' '}
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