import { Box, Typography, Stack, Paper, Grow } from '@mui/material';
import { useInView } from '../hooks/useInView';
import { useMotionTimeout } from '../hooks/useReducedMotion';
import LanguageIcon from '@mui/icons-material/Language';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ApiIcon from '@mui/icons-material/Api';

const steps = [
  {
    icon: <LanguageIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
    step: '01',
    title: 'Scrape Sources',
    description:
      'An automated actor scrapes rates hourly from official financial sources, news sites, and exchange platforms across Zimbabwe.',
  },
  {
    icon: <AnalyticsIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
    step: '02',
    title: 'Aggregate & Validate',
    description:
      'Rates are normalised and aggregated — you can request min, max, mean, median, or mode across all sources.',
  },
  {
    icon: <ApiIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
    step: '03',
    title: 'Fetch via API',
    description:
      'Consume the rates through our REST API or GraphQL endpoint. No key, no subscription — just a simple HTTP request.',
  },
];

export default function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const timeout = useMotionTimeout(600);

  return (
    <Box
      id="how-it-works"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.subtle',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} align="center" gutterBottom>
          How It Works
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 6, maxWidth: 560, mx: 'auto' }}>
          From live financial sources to your application in three simple steps.
        </Typography>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems="stretch"
          ref={ref}
        >
          {steps.map(({ icon, step, title, description }, index) => (
            <Grow
              key={title}
              in={inView}
              timeout={timeout}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
            <Paper
              sx={{
                flex: 1,
                p: 4,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 20,
                  fontSize: '4rem',
                  fontWeight: 900,
                  color: 'divider',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {step}
              </Typography>
              {icon}
              <Typography variant="h6" fontWeight={700}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                {description}
              </Typography>
              {index < steps.length - 1 && (
                <Box
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    position: 'absolute',
                    right: -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'divider',
                    fontSize: '2rem',
                    zIndex: 1,
                  }}
                >
                  →
                </Box>
              )}
            </Paper>
            </Grow>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
