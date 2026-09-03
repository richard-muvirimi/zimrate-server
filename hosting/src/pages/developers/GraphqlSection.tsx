import { useEffect, useId, useRef } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Divider, Paper, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeBlock from './CodeBlock';
import ParamList from './ParamList';
import { GRAPHQL_PARAMS } from './params';
import { GRAPHQL_QUERY } from './examples';

export default function GraphqlSection({
  graphqlUrl,
  paramDocs,
  expanded,
  onExpandedChange,
  onOpenPlayground,
}: {
  graphqlUrl: string;
  paramDocs: Record<string, string>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenPlayground: () => void;
}) {
  const sandboxId = useId().replace(/:/g, '-');
  const sandboxInitialized = useRef(false);

  useEffect(() => {
    // The playground starts collapsed, so most readers never open it. Waiting
    // for the first expand keeps @apollo/sandbox out of the page chunk and
    // skips building the sandbox for everyone who only reads the docs.
    if (!expanded || sandboxInitialized.current) {
      return;
    }

    let cancelled = false;

    import('@apollo/sandbox').then(({ ApolloSandbox }) => {
      if (cancelled || sandboxInitialized.current) {
        return;
      }

      sandboxInitialized.current = true;

      new ApolloSandbox({
        target: `#${sandboxId}`,
        initialEndpoint: graphqlUrl,
        initialState: {
          document: GRAPHQL_QUERY,
        },
        endpointIsEditable: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [expanded, graphqlUrl, sandboxId]);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Typography id="graphql" variant="h4" sx={{ scrollMarginTop: 96 }}>
          GraphQL Example
        </Typography>
        <Button onClick={onOpenPlayground} variant="outlined" size="small" endIcon={<OpenInNewIcon />}>
          Open GraphQL Playground
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Unlike REST, GraphQL allows you to structure the responses however you like, even reducing the number of requests made to the server in one go.
      </Typography>

      {/* Parameters before the example, matching the REST tabs. */}
      <Typography variant="h6" gutterBottom>Parameters</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        The <code>rate</code> query accepts these five. It has no equivalent of the REST{' '}
        <code>callback</code>, <code>extra</code> or <code>info</code> parameters —{' '}
        <code>info</code> is a field you select instead.
      </Typography>
      <Box sx={{ mb: 3 }}>
        <ParamList names={GRAPHQL_PARAMS} docs={paramDocs} />
      </Box>

      <Typography variant="h6" gutterBottom>Query</Typography>
      <CodeBlock language="graphql" code={GRAPHQL_QUERY} />

      {/* Separated so a collapsed playground does not read as one more
          parameter row in the list above it. */}
      <Divider sx={{ mt: 4, mb: 3 }} />

      <Accordion
        id="graphql-playground"
        variant="outlined"
        expanded={expanded}
        onChange={(_event, next) => onExpandedChange(next)}
        sx={{ scrollMarginTop: 96 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">GraphQL Playground</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            The query above is preloaded here as a starting point.
          </Typography>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Box id={sandboxId} sx={{ height: 760, borderRadius: 2, overflow: 'hidden' }} />
          </Paper>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
