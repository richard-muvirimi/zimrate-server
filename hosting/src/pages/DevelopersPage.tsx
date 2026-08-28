import { useMemo, useState } from 'react';
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery } from '@apollo/client/react';
import PageHero from '../components/PageHero';
import SiteLayout from '../components/SiteLayout';
import { GET_RATES } from '../graphql/queries';
import GraphqlSection from './developers/GraphqlSection';
import JsonpSection from './developers/JsonpSection';
import OverviewSection from './developers/OverviewSection';
import RestSection from './developers/RestSection';
import { buildParamDocs } from './developers/params';
import type { RestVersion } from './developers/types';

interface RateRow {
  currency: string;
}

interface DevelopersData {
  rates: RateRow[];
}

export default function DevelopersPage() {
  const { data, loading } = useQuery<DevelopersData>(GET_RATES);
  const [expandedPlayground, setExpandedPlayground] = useState<'graphql' | 'jsonp' | false>(false);
  // One selection shared by the REST and JSONP sections, so they can never
  // disagree about which version is being documented.
  const [restVersion, setRestVersion] = useState<RestVersion>('v2');

  const origin = window.location.origin;
  const restUrl = `${origin}/api/v1`;
  const restV2Url = `${origin}/api/v2`;
  const graphqlUrl = `${origin}/api/graphql`;
  const openApiUrl = `${origin}/docs/documentation.yaml`;

  const currencyList = useMemo(
    () => Array.from(new Set((data?.rates ?? []).map((item) => item.currency))).sort().join(', '),
    [data],
  );

  const paramDocs = useMemo(
    () => buildParamDocs({ loading, currencyList }),
    [loading, currencyList],
  );

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
          <OverviewSection openApiUrl={openApiUrl} loading={loading} />

          {/* Each api is long enough to fill a screen on its own, so the gap
              between them is deliberately much larger than any gap inside one,
              with a rule to make the boundary unmistakable. */}
          <Stack spacing={8} divider={<Divider />}>
            <RestSection
              version={restVersion}
              onVersionChange={setRestVersion}
              restUrl={restUrl}
              restV2Url={restV2Url}
              openApiUrl={openApiUrl}
            />

            <JsonpSection
              version={restVersion}
              onVersionChange={setRestVersion}
              restUrl={restUrl}
              restV2Url={restV2Url}
              expanded={expandedPlayground === 'jsonp'}
              onExpandedChange={(expanded) => setExpandedPlayground(expanded ? 'jsonp' : false)}
              onOpenPlayground={() => openPlayground('jsonp')}
            />

            <GraphqlSection
              graphqlUrl={graphqlUrl}
              paramDocs={paramDocs}
              expanded={expandedPlayground === 'graphql'}
              onExpandedChange={(expanded) => setExpandedPlayground(expanded ? 'graphql' : false)}
              onOpenPlayground={() => openPlayground('graphql')}
            />
          </Stack>

          <Paper sx={{ mt: 8, p: 3, borderRadius: 3 }}>
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
