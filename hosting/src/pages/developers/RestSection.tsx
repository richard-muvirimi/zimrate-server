import { Box, Typography } from '@mui/material';
import CodeBlock from './CodeBlock';
import SpecPanel from './SpecPanel';
import VersionTabs from './VersionTabs';
import { REST_RESPONSE, REST_V2_RESPONSE, restRequest, restV2Request } from './examples';
import type { RestVersion } from './types';

export default function RestSection({
  version,
  onVersionChange,
  restUrl,
  restV2Url,
  openApiUrl,
}: {
  version: RestVersion;
  onVersionChange: (next: RestVersion) => void;
  restUrl: string;
  restV2Url: string;
  openApiUrl: string;
}) {
  // A real, clickable url rather than a /{base} template — v2 needs a currency
  // in the path to respond at all.
  const versionUrl = version === 'v2' ? `${restV2Url}/ZAR` : restUrl;

  return (
    <Box>
      <Typography id="rest" variant="h4" gutterBottom sx={{ scrollMarginTop: 96 }}>
        REST Example
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Rates can be retrieved through the REST api using either GET or POST. There are
        two versions and both are fully supported, so choose whichever fits your use.
      </Typography>

      <VersionTabs value={version} onChange={onVersionChange} idPrefix="rest" />

      {version === 'v2' && (
        <Box role="tabpanel" id="rest-panel-v2" aria-labelledby="rest-tab-v2">
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Pick any currency as your base and every rate comes back converted to it.
            Put it in the url, like <code>/api/v2/ZAR</code> — upper or lower case, it
            does not matter. Each rate arrives with its full detail, and the base
            currency itself is left out, since against itself it would always be 1.
          </Typography>

          <Typography variant="h6" gutterBottom>Request</Typography>
          <Box sx={{ mb: 3 }}>
            <CodeBlock language="bash" code={restV2Request(restV2Url)} />
          </Box>

          <Typography variant="h6" gutterBottom>Response</Typography>
          <CodeBlock language="json" code={REST_V2_RESPONSE} />
        </Box>
      )}

      {version === 'v1' && (
        <Box role="tabpanel" id="rest-panel-v1" aria-labelledby="rest-tab-v1">
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            The original endpoint. Every rate comes back against the US dollar, and you
            get only the fields your request asks for. It is unchanged and fully
            supported — if it already works for you, there is no reason to move.
          </Typography>

          <Typography variant="h6" gutterBottom>Request</Typography>
          <Box sx={{ mb: 3 }}>
            <CodeBlock language="bash" code={restRequest(restUrl)} />
          </Box>

          <Typography variant="h6" gutterBottom>Response</Typography>
          <CodeBlock language="json" code={REST_RESPONSE} />
        </Box>
      )}

      <Box id="rest-specification" sx={{ mt: 3, scrollMarginTop: 96 }}>
        <Typography variant="h4" gutterBottom>
          REST Api Specification
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {/* Follows the tab above, so the link never contradicts the version
              the reader is looking at. */}
          Link:{' '}
          <Box component="a" href={versionUrl} sx={{ color: 'primary.main' }}>
            {versionUrl}
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          Showing the {version} operations. Switch the tabs above for the other version,
          or open the{' '}
          <Box component="a" href={openApiUrl} target="_blank" rel="noopener" sx={{ color: 'primary.main' }}>
            full specification
          </Box>{' '}
          for both.
        </Typography>
        <SpecPanel openApiUrl={openApiUrl} version={version} />
      </Box>
    </Box>
  );
}
