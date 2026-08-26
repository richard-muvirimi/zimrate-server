import { Box, Typography, Stack, Paper, SvgIcon, Button, Grow } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import { useInView } from '../hooks/useInView';
import { useMotionTimeout } from '../hooks/useReducedMotion';

function GooglePlayIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    </SvgIcon>
  );
}

function WordPressIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0zM1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.211 16.271 1.211 12zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609zm1.488-15.854c.647-.03 1.232-.1 1.232-.1.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .923-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zm7.981-.105c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11z" />
    </SvgIcon>
  );
}

const apps = [
  {
    name: 'My Rate Calculator',
    platform: 'Android app on Google Play',
    description:
      'Check and convert rates on the go. Built on this same API, free on the Play Store.',
    href: 'https://play.google.com/store/apps/details?id=com.tyganeutronics.myratecalculator&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1',
    cta: 'Get it on Google Play',
    Icon: GooglePlayIcon,
  },
  {
    name: 'ZimRate for WordPress',
    platform: 'Plugin on WordPress.org',
    description:
      'Drop live exchange rates into any WordPress site with a shortcode. No API key needed.',
    href: 'https://wordpress.org/plugins/zimrate',
    cta: 'View on WordPress.org',
    Icon: WordPressIcon,
  },
];

export default function OfficialAppsSection() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const timeout = useMotionTimeout(600);

  return (
    <Box
      id="apps"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} align="center" gutterBottom>
          Official apps using this service
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          align="center"
          sx={{ mb: 6, maxWidth: 560, mx: 'auto' }}
        >
          Prefer not to write code? These are built and maintained on top of the same API.
        </Typography>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems="stretch"
          justifyContent="center"
          ref={ref}
        >
          {apps.map(({ name, platform, description, href, cta, Icon }, i) => (
            <Grow key={name} in={inView} timeout={timeout} style={{ transitionDelay: `${i * 100}ms` }}>
              <Paper
                sx={{
                  flex: 1,
                  maxWidth: { md: 460 },
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'border-color 0.2s, transform 0.2s',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                }}
              >
                <Icon sx={{ fontSize: 34, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>
                  {name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                  {platform}
                </Typography>
                <Typography variant="body2" color="text.secondary" lineHeight={1.7} sx={{ flexGrow: 1 }}>
                  {description}
                </Typography>
                <Button
                  variant="outlined"
                  href={href}
                  target="_blank"
                  rel="noopener"
                  startIcon={<Icon />}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                >
                  {cta}
                </Button>
              </Paper>
            </Grow>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
