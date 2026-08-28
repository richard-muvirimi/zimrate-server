import { Box, Typography, Grid, Paper, Grow } from '@mui/material';
import { useInView } from '../hooks/useInView';
import { useMotionTimeout } from '../hooks/useReducedMotion';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import UpdateIcon from '@mui/icons-material/Update';
import CodeIcon from '@mui/icons-material/Code';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const features = [
  {
    icon: <MoneyOffIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'Completely Free',
    description: 'No pricing tiers, no API keys, no rate limits. The API is free to use by anyone — hobbyists, startups, and enterprises alike.',
  },
  {
    icon: <UpdateIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'Real-Time Data',
    description: 'Rates are scraped and updated hourly from multiple Zimbabwean financial sources, ensuring you always get current values.',
  },
  {
    icon: <CodeIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'REST + GraphQL',
    description: 'Use the simple REST endpoint for quick integrations, or leverage GraphQL for flexible, typed queries with only the fields you need.',
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'Statistical Aggregation',
    description: 'Get the MIN, MAX, MEAN, MEDIAN, or MODE across all sources. Choose the aggregation method that fits your use case.',
  },
  {
    icon: <TrendingUpIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'Change Tracking',
    description: 'Pass a UNIX timestamp to get only the rates that have moved since then, and read each rate alongside its previous value.',
  },
  {
    icon: <OpenInNewIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    title: 'Source Transparency',
    description: 'Every rate comes with a URL pointing to the original source, so you can verify data directly and maintain audit trails.',
  },
];

export default function FeaturesSection() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const timeout = useMotionTimeout(600);

  return (
    <Box
      id="features"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} align="center" gutterBottom>
          Why ZimRate?
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 6, maxWidth: 520, mx: 'auto' }}>
          Built specifically for Zimbabwe's unique multi-currency environment.
        </Typography>

        {/* 100ms stagger mirrors the legacy ScrollReveal `interval: 100`. */}
        <Grid container spacing={3} ref={ref}>
          {features.map(({ icon, title, description }, i) => (
            <Grid key={title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Grow in={inView} timeout={timeout} style={{ transitionDelay: `${i * 100}ms` }}>
                <Paper
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'border-color 0.2s, transform 0.2s',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box>{icon}</Box>
                  <Typography variant="h6" fontWeight={700}>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                    {description}
                  </Typography>
                </Paper>
              </Grow>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
