import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Divider, Paper, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeBlock from './CodeBlock';
import VersionTabs from './VersionTabs';
import { jsonpRequest } from './examples';
import type { RestVersion } from './types';

export default function JsonpSection({
  version,
  onVersionChange,
  restUrl,
  restV2Url,
  expanded,
  onExpandedChange,
  onOpenPlayground,
}: {
  version: RestVersion;
  onVersionChange: (next: RestVersion) => void;
  restUrl: string;
  restV2Url: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenPlayground: () => void;
}) {
  const example = jsonpRequest(version === 'v2' ? restV2Url : restUrl, version);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Typography id="jsonp" variant="h4" sx={{ scrollMarginTop: 96 }}>
          JSONP Example
        </Typography>
        <Button onClick={onOpenPlayground} variant="outlined" size="small" endIcon={<OpenInNewIcon />}>
          Open JSONP Playground
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        You can use JSONP callbacks by using the script tag with the url having the parameter callback, where the value will be the name of the function you want called after the tag is loaded.
        Both versions support it, and the response is the same shape each returns normally.
      </Typography>

      <VersionTabs value={version} onChange={onVersionChange} idPrefix="jsonp" />

      <Box role="tabpanel" id={`jsonp-panel-${version}`} aria-labelledby={`jsonp-tab-${version}`}>
        <CodeBlock language="javascript" code={example} />
      </Box>

      {/* Separated so a collapsed playground does not read as one more row of
          whatever list precedes it. */}
      <Divider sx={{ mt: 4, mb: 3 }} />

      <Accordion
        id="jsonp-playground"
        variant="outlined"
        expanded={expanded}
        onChange={(_event, next) => onExpandedChange(next)}
        sx={{ scrollMarginTop: 96 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">JSONP Playground</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            Feel free to interact with the example in the CodePen below. The pen itself
            calls version 1 — it is hosted externally, so it does not follow the tabs.
            The snippet above does.
          </Typography>
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
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
