import { Box, Typography, Button, Stack, Chip, Fade, Grow } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import CalculatorWidget from '../components/CalculatorWidget';
import { useMotionTimeout } from '../hooks/useReducedMotion';

export default function HeroSection() {
  // Above the fold, so this animates on mount rather than on scroll.
  const timeout = useMotionTimeout(700);

  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          gap: { xs: 6, md: 8 },
        }}
      >
        {/* Left: headline */}
        <Fade in timeout={timeout}>
        <Box sx={{ flex: 1 }}>
          <Chip
            label="100% Free · No API Key Required"
            color="primary"
            variant="outlined"
            size="small"
            sx={{ mb: 3, fontWeight: 600 }}
          />

          <Typography
            variant="h2"
            fontWeight={700}
            sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, mb: 2, lineHeight: 1.2 }}
          >
            Zimbabwe Exchange Rates,{' '}
            <Box component="span" color="primary.main">
              Free & Real-Time
            </Box>
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            fontWeight={400}
            sx={{ mb: 4, maxWidth: 480, lineHeight: 1.6 }}
          >
            Aggregated from multiple Zimbabwean financial sources. Available via REST and GraphQL.
            No sign-up, no rate limits.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {/* RouterLink, not a native href: a native hash jump bypasses the
                router and behaves differently from the identical header links. */}
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/#rates"
              sx={{ px: 4 }}
            >
              View Live Rates
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={RouterLink}
              to="/#docs"
              sx={{ px: 4 }}
            >
              API Docs
            </Button>
          </Stack>

          <Stack direction="row" spacing={3} sx={{ mt: 4 }}>
            {[
              { value: '10+', label: 'Sources' },
              { value: 'Hourly', label: 'Updates' },
              { value: 'Free', label: 'Forever' },
            ].map(({ value, label }) => (
              <Box key={label}>
                <Typography variant="h6" fontWeight={700} color="primary">
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
        </Fade>

        {/* Right: calculator */}
        <Grow in timeout={timeout} style={{ transitionDelay: '150ms' }}>
          <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>
            <CalculatorWidget />

            {/* A plain anchor, not a RouterLink: /calculator/ is a separate app
                with its own bundle and service worker, not a route in this one. */}
            <Button
              component="a"
              href="/calculator/"
              startIcon={<CalculateOutlinedIcon />}
              size="small"
              sx={{ mt: 1.5 }}
            >
              Advanced calculator
            </Button>
          </Box>
        </Grow>
      </Box>
    </Box>
  );
}
