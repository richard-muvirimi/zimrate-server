import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Divider, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeBlock from './CodeBlock';
import SpecPanel from './SpecPanel';
import VersionTabs from './VersionTabs';
import { restRequest } from './examples';
import type { RestVersion } from './types';

export default function RestSection({
  version,
  onVersionChange,
  restUrl,
  restV2Url,
  openApiUrl,
  postmanUrl,
  base,
  expanded,
  onExpandedChange,
  onOpenPlayground,
}: {
  version: RestVersion;
  onVersionChange: (next: RestVersion) => void;
  restUrl: string;
  restV2Url: string;
  openApiUrl: string;
  postmanUrl: string;
  base: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenPlayground: () => void;
}) {
  // A real, clickable url rather than a /{base} template — v2 needs a currency
  // in the path to respond at all.
  const versionUrl = version === 'v2' ? `${restV2Url}/${base}` : restUrl;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Typography id="rest" variant="h4" sx={{ scrollMarginTop: 96 }}>
          REST Example
        </Typography>
        <Button onClick={onOpenPlayground} variant="outlined" size="small" endIcon={<OpenInNewIcon />}>
          Open REST Playground
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Rates can be retrieved through the REST api using either GET or POST. There are
        two versions and both are fully supported, so choose whichever fits your use.
      </Typography>

      <VersionTabs value={version} onChange={onVersionChange} idPrefix="rest" />

      <Box role="tabpanel" id={`rest-panel-${version}`} aria-labelledby={`rest-tab-${version}`}>
        {version === 'v2' ? (
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Pick any currency as your base and every rate comes back converted to it.
            Put it in the url, like <code>/api/v2/{base}</code> — upper or lower case, it
            does not matter. Each rate arrives with its full detail, and the base
            currency itself is left out, since against itself it would always be 1.
          </Typography>
        ) : (
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            The original endpoint. Every rate comes back against the US dollar, and you
            get only the fields your request asks for. It is unchanged and fully
            supported — if it already works for you, there is no reason to move.
          </Typography>
        )}

        <Typography variant="h6" gutterBottom>Request</Typography>
        <CodeBlock language="bash" code={restRequest(versionUrl)} />
      </Box>

      {/* Separated so a collapsed playground does not read as part of the
          example above it. */}
      <Divider sx={{ mt: 4, mb: 3 }} />

      <Accordion
        id="rest-playground"
        variant="outlined"
        expanded={expanded}
        onChange={(_event, next) => onExpandedChange(next)}
        // Mounted on first expand, so the spec fetch and Scalar's chunk are
        // skipped for everyone who only reads the example.
        slotProps={{ transition: { mountOnEnter: true } }}
        sx={{ scrollMarginTop: 96 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">REST Playground</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            {/* Follows the tab above, so the text never contradicts the version
                the reader is looking at. */}
            The {version} specification, with every parameter and response. Use Test
            Request to send a call, or open the{' '}
            <Box component="a" href={openApiUrl} target="_blank" rel="noopener" sx={{ color: 'primary.main' }}>
              full specification
            </Box>{' '}
            for both versions.
          </Typography>
          <SpecPanel openApiUrl={openApiUrl} postmanUrl={postmanUrl} version={version} />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
