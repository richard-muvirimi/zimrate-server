import { Box, Button, Chip, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PREFER_VALUES } from './params';

const APIS = [
  { label: 'REST API', anchor: '#rest' },
  { label: 'JSONP API', anchor: '#jsonp' },
  { label: 'GraphQL API', anchor: '#graphql' },
];

export default function OverviewSection({
  openApiUrl,
  loading,
}: {
  openApiUrl: string;
  loading: boolean;
}) {
  return (
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
            {APIS.map((api) => (
              <Box key={api.anchor}>
                <Typography variant="h6">{api.label}</Typography>
                <Button component="a" href={api.anchor} size="small" sx={{ mt: 0.5, px: 0 }}>
                  Documentation
                </Button>
              </Box>
            ))}
          </Stack>

          <Typography variant="h4" gutterBottom>
            Filtering Rates
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Every api accepts query parameters to narrow what comes back. Each one takes a
            different set, so they are listed with the api that accepts them — the REST
            parameters are under each version below, and the Graphql ones under Graphql.
          </Typography>
          <Typography color="text.secondary">
            Apart from <code>base</code> on version 2 of the REST api, they are all optional
            and are there only as a convenience to get the specific data that you need.
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
            {PREFER_VALUES.map((item) => (
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
  );
}
