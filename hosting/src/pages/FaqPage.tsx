import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PageHero from '../components/PageHero';
import SafeEmail from '../components/SafeEmail';
import { useBranding } from '../useBranding';
import SiteLayout from '../components/SiteLayout';

const faqItems = [
  {
    question: 'What the heck is this?',
    answer:
      'ZimRate is a free API and app surface that collects Zimbabwean exchange rate updates from multiple sources and makes them available from one place.',
  },
  {
    question: 'Why does ZimRate exist?',
    answer:
      'The original problem was having to jump between multiple sites, then manually work out an average, minimum, or maximum rate. ZimRate automates that aggregation so developers and end users can work from one consistent feed.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Use the developers page for REST, JSONP, and GraphQL examples. The API does not require authentication for public rate access.',
  },
  {
    question: 'How much do I pay?',
    answer: 'Nothing. The service is free to use.',
  },
  {
    question: 'What if I need a feature that does not exist yet?',
    answer:
      'Get in touch and suggest it. The project is actively developed and requests genuinely do shape what gets built next.',
  },
  {
    question: 'Is this stable enough to rely on?',
    answer:
      'The API is versioned so newer changes do not need to break older integrations. You should still cache rates when practical because source data changes on a schedule rather than continuously.',
  },
  {
    question: 'Are donations welcome?',
    answer:
      'Yes. If you rely on the project or want to support further work, you can get in touch through the project website.',
  },
];

export default function FaqPage() {
  const branding = useBranding();

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Support"
        title="Frequently Asked Questions"
        description="Common questions about the service, the API, and what it costs. Short answers, no sign-up required."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button component={RouterLink} to="/developers" variant="contained" size="large">
              Developer Docs
            </Button>
            <Button component={RouterLink} to="/privacy" variant="outlined" size="large">
              Privacy Policy
            </Button>
          </Stack>
        }
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Stack spacing={2}>
            {faqItems.map((item) => (
              <Accordion key={item.question} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">{item.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography color="text.secondary">{item.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>

          <Box
            sx={{
              mt: 4,
              p: 3,
              border: '1px solid', borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Need something more specific?
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Product and API questions can be directed through the main project site or by email.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {branding.author_url && (
                <Button
                  component="a"
                  href={branding.author_url}
                  target="_blank"
                  rel="noopener"
                  variant="outlined"
                >
                  Visit Website
                </Button>
              )}
              {branding.author_email && (
                <SafeEmail
                  email={branding.author_email}
                  underline="hover"
                  sx={{ alignSelf: 'center' }}
                />
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </SiteLayout>
  );
}