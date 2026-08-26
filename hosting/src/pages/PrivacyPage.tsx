import { Box, Stack, Typography } from '@mui/material';
import PageHero from '../components/PageHero';
import SafeEmail from '../components/SafeEmail';
import { useBranding } from '../useBranding';
import SiteLayout from '../components/SiteLayout';

const sections = [
  {
    title: '1. What information we collect',
    body: [
      'We collect information you choose to provide when you contact us, request information, or interact with the service in ways that require a direct response.',
      'We also collect basic technical and usage data automatically when you use the website or app, including information like IP address, browser or device characteristics, operating system, referrer information, and interaction telemetry used for security and analytics.',
      'When you use the mobile app, device-level information may also be collected for app functionality, diagnostics, and reporting. Depending on platform capabilities and app features, that may include device identifiers, operating system details, and permission-gated capabilities you explicitly allow.',
    ],
  },
  {
    title: '2. How we use your information',
    body: [
      'We use collected information to operate and secure the service, improve reliability, support users, measure usage, and communicate updates about the product or policy changes.',
      'Information may also be processed where necessary to comply with legal obligations, investigate abuse, prevent fraud, and maintain service integrity.',
    ],
  },
  {
    title: '3. When information may be shared',
    body: [
      'Information may be shared with infrastructure or service providers who help operate the platform, or when required to respond to lawful requests, protect users, or enforce the platform terms and policies.',
      'The service is not built around selling personal information.',
    ],
  },
  {
    title: '4. Retention and security',
    body: [
      'Information is retained only for as long as it is needed for the purposes described above, including operational, analytical, and legal requirements.',
      'Reasonable technical and organizational safeguards are used, but no system can guarantee absolute security.',
    ],
  },
  {
    title: '5. Your choices and rights',
    body: [
      'You can limit what you share, control device permissions through your operating system, and contact us if you want to review, update, or request deletion of information you previously provided.',
      'Browser-level controls such as do-not-track may exist, but there is no universal standard for how those signals are interpreted across all services.',
    ],
  },
  {
    title: '6. Contact',
    body: [
      'Questions about this policy or requests relating to your information can be sent by email.',
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
            Last updated August 25, 2026
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
                ZimRate is committed to protecting your personal information and your right to privacy. This policy covers the website, the API, and the mobile app.
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