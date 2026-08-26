import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { ApolloSandbox } from '@apollo/sandbox';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@apollo/client/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RedocStandalone } from 'redoc';
import PageHero from '../components/PageHero';
import SiteLayout from '../components/SiteLayout';
import { GET_RATES } from '../graphql/queries';

interface RateSummary {
  currency: string;
  rate: number;
}

interface RateRow {
  currency: string;
}

interface DevelopersData {
  min: RateSummary[];
  max: RateSummary[];
  mean: RateSummary[];
  rates: RateRow[];
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Paper
      sx={{
        position: 'relative',
        bgcolor: 'code.bg',
        border: '1px solid', borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderBottomColor: 'divider' }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {language}
        </Typography>
        <Button size="small" color="inherit" startIcon={<ContentCopyIcon />} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Stack>
      <Box component="pre" sx={{ m: 0, p: 2.5, overflowX: 'auto', fontSize: '0.9rem' }}>
        <Box component="code" sx={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace', color: 'code.text' }}>
          {code}
        </Box>
      </Box>
    </Paper>
  );
}

export default function DevelopersPage() {
  const { data, loading } = useQuery<DevelopersData>(GET_RATES);
  const [expandedPlayground, setExpandedPlayground] = useState<'graphql' | 'jsonp' | false>(false);
  const sandboxId = useId().replace(/:/g, '-');
  const sandboxInitialized = useRef(false);

  const origin = window.location.origin;
  const restUrl = `${origin}/api/v1`;
  const graphqlUrl = `${origin}/api/graphql`;
  const openApiUrl = `${origin}/docs/documentation.yaml`;

  const uniqueCurrencies = Array.from(new Set((data?.rates ?? []).map((item) => item.currency))).sort();
  const currencyList = uniqueCurrencies.join(', ');
  const preferList = ['MAX', 'MIN', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE'].join(', ');

  const jsonpExample = useMemo(
    () => [
      'var s = document.createElement("script");',
      `s.src = "${restUrl}?callback=myFunction";`,
      'document.body.appendChild(s);',
      '',
      'function myFunction(rates) {',
      '  console.log(rates);',
      '}',
    ].join('\n'),
    [restUrl],
  );

  const graphqlExample = useMemo(
    () => [
      'query {',
      '  USD: rate(prefer: RANDOM) {',
      '    currency',
      '    last_checked',
      '    last_updated',
      '    rate',
      '  }',
      '  notice: info',
      '}',
    ].join('\n'),
    [],
  );

  const restExample = [
    `curl -X POST ${restUrl} \\`,
    "  -d 'prefer=mean' \\",
    "  -d 'currency=ZWG'",
  ].join('\n');

  useEffect(() => {
    if (sandboxInitialized.current) {
      return;
    }

    sandboxInitialized.current = true;

    new ApolloSandbox({
      target: `#${sandboxId}`,
      initialEndpoint: graphqlUrl,
      initialState: {
        document: graphqlExample,
      },
      endpointIsEditable: false,
    });
  }, [graphqlExample, graphqlUrl, sandboxId]);

  const openPlayground = (playground: 'graphql' | 'jsonp') => {
    setExpandedPlayground(playground);

    requestAnimationFrame(() => {
      document.getElementById(`${playground}-playground`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <SiteLayout>
      <PageHero
        eyebrow="API Docs"
        title="For Software Developers"
        description="The api can be accessed through REST, JSONP and GraphQL. Query parameters, examples and the specification are listed below."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button component="a" href="#rest-specification" variant="contained" size="large">
              REST API Specification
            </Button>
            <Button component="a" href={openApiUrl} target="_blank" rel="noopener" variant="outlined" size="large" endIcon={<OpenInNewIcon />}>
              Open Spec File
            </Button>
          </Stack>
        }
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="h4" gutterBottom>
                  Retrieving Rates
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  The api can be accessed through:
                </Typography>

                <Stack spacing={2.5} sx={{ mb: 4 }}>
                  <Box>
                    <Typography variant="h6">REST API</Typography>
                    <Button component="a" href="#rest" size="small" sx={{ mt: 0.5, px: 0 }}>
                      Documentation
                    </Button>
                  </Box>

                  <Box>
                    <Typography variant="h6">JSONP API</Typography>
                    <Button component="a" href="#jsonp" size="small" sx={{ mt: 0.5, px: 0 }}>
                      Documentation
                    </Button>
                  </Box>

                  <Box>
                    <Typography variant="h6">GraphQL API</Typography>
                    <Button component="a" href="#graphql" size="small" sx={{ mt: 0.5, px: 0 }}>
                      Documentation
                    </Button>
                  </Box>
                </Stack>

                <Typography variant="h4" gutterBottom>
                  Filtering Rates
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  There are four possible query parameters that can be passed to get data from both the RESTful and Graphql Api.
                </Typography>

                <Stack spacing={1.5}>
                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography><code>search</code></Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography color="text.secondary">
                        Allows you to get currency rates using only part of a currency or source name.
                      </Typography>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography><code>currency</code></Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography color="text.secondary">
                        {loading
                          ? 'Can only be one of the supported currencies. Loading the current list...'
                          : `Can only be one of: ${currencyList || 'none yet'}. Use this when you require a specific currency.`}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography><code>date</code></Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography color="text.secondary">
                        When provided, only matching rates after this date will be returned. Accepts common date formats, though a Unix timestamp is preferred.
                      </Typography>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography><code>prefer</code></Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography color="text.secondary">
                        Can only be one of {preferList} or empty to return the whole list.
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                </Stack>

                <Typography color="text.secondary" sx={{ mt: 3 }}>
                  All these parameters are optional and are there only as a convenience to get the specific data that you need.
                </Typography>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="h5" gutterBottom>
                  Documentation
                </Typography>
                <Stack spacing={2}>
                  <Button component="a" href={openApiUrl} target="_blank" rel="noopener" variant="outlined" endIcon={<OpenInNewIcon />}>
                    OpenAPI Specification
                  </Button>
                  <Button component="a" href="#rest-specification" variant="outlined">
                    View REST Documentation
                  </Button>
                </Stack>

                <Typography color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                  Common aggregates
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {['MIN', 'MAX', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE'].map((item) => (
                    <Chip key={item} label={item} variant="outlined" />
                  ))}
                </Stack>

                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading live currency list
                    </Typography>
                  </Box>
                ) : null}
              </Paper>
            </Grid>
          </Grid>

          <Stack spacing={3}>
            <Box>
              <Typography id="rest" variant="h4" gutterBottom sx={{ scrollMarginTop: 96 }}>
                REST Example
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Rates can be retrieved through the REST api using either GET or POST.
              </Typography>
              <CodeBlock language="bash" code={restExample} />

              <Box id="rest-specification" sx={{ mt: 3, scrollMarginTop: 96 }}>
                <Typography variant="h4" gutterBottom>
                  REST Api Specification
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Link: <Box component="a" href={restUrl} sx={{ color: 'primary.main' }}>{restUrl}</Box>
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2.5 }}>
                  Rates can be retrieved through the rest api using either GET or POST.
                </Typography>
                {/* Redoc renders light-only, so this container is pinned white
                    in both schemes rather than inheriting the surface token. */}
                <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden', bgcolor: 'common.white' }}>
                  <Box sx={{ height: { xs: 900, md: 1200 }, overflowY: 'auto', bgcolor: 'common.white' }}>
                    <RedocStandalone
                      specUrl={openApiUrl}
                      options={{
                        hideDownloadButton: true,
                        expandResponses: '200,201',
                        nativeScrollbars: true,
                        theme: {
                          colors: {
                            // Brand blue, readable on Redoc's white canvas.
                            primary: {
                              main: '#0B6FD0',
                            },
                          },
                        },
                      }}
                    />
                  </Box>
                </Paper>
              </Box>
            </Box>

            <Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 2 }}>
                <Typography id="jsonp" variant="h4" sx={{ scrollMarginTop: 96 }}>
                  JSONP Example
                </Typography>
                <Button
                  onClick={() => openPlayground('jsonp')}
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                >
                  Open JSONP Playground
                </Button>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                You can use JSONP callbacks by using the script tag with the url having the parameter callback, where the value will be the name of the function you want called after the tag is loaded.
              </Typography>
              <CodeBlock language="javascript" code={jsonpExample} />

              <Accordion
                id="jsonp-playground"
                expanded={expandedPlayground === 'jsonp'}
                onChange={(_event, expanded) => setExpandedPlayground(expanded ? 'jsonp' : false)}
                sx={{ mt: 2, scrollMarginTop: 96 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">JSONP Playground</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography color="text.secondary" sx={{ mb: 2.5 }}>
                    Feel free to interact with the example in the CodePen below.
                  </Typography>
                  <Stack spacing={3}>
                    <CodeBlock language="javascript" code={jsonpExample} />
                    <Paper sx={{ p: 1.5, borderRadius: 3 }}>
                      <Box
                        component="iframe"
                        title="ZimRate JSONP CodePen"
                        src="https://codepen.io/tygalive/embed/ZEVWOqm?default-tab=js%2Cresult&editable=true"
                        sx={{ width: '100%', minHeight: 520, border: 0, borderRadius: 2 }}
                        loading="lazy"
                        allow="clipboard-write"
                        allowFullScreen
                      />
                    </Paper>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>

            <Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 2 }}>
                <Typography id="graphql" variant="h4" sx={{ scrollMarginTop: 96 }}>
                  GraphQL Example
                </Typography>
                <Button
                  onClick={() => openPlayground('graphql')}
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                >
                  Open GraphQL Playground
                </Button>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Unlike REST, GraphQL allows you to structure the responses however you like, even reducing the number of requests made to the server in one go.
              </Typography>
              <CodeBlock language="graphql" code={graphqlExample} />

              <Accordion
                id="graphql-playground"
                expanded={expandedPlayground === 'graphql'}
                onChange={(_event, expanded) => setExpandedPlayground(expanded ? 'graphql' : false)}
                sx={{ mt: 2, scrollMarginTop: 96 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">GraphQL Playground</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography color="text.secondary" sx={{ mb: 2.5 }}>
                    You may use the preloaded example below as a starting point.
                  </Typography>
                  <Stack spacing={2}>
                    <CodeBlock language="graphql" code={graphqlExample} />
                    <Paper sx={{ p: 2, borderRadius: 3 }}>
                      <Box id={sandboxId} sx={{ height: 760, borderRadius: 2, overflow: 'hidden' }} />
                    </Paper>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          </Stack>

          <Paper sx={{ mt: 4, p: 3, borderRadius: 3 }}>
            <Typography variant="h5" gutterBottom>
              ...
            </Typography>
            <Stack spacing={1.5}>
              <Typography color="text.secondary">The ordering of returned rates is not guaranteed.</Typography>
              <Typography color="text.secondary">You can disable the informational string in REST responses by passing <code>info=false</code>.</Typography>
              <Typography color="text.secondary">Caching is encouraged because source rates are scraped on a schedule rather than continuously.</Typography>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </SiteLayout>
  );
}