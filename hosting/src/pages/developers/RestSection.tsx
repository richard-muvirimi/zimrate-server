import { Box, Typography } from '@mui/material';
import CodeBlock from './CodeBlock';
import ParamList from './ParamList';
import SpecPanel from './SpecPanel';
import VersionTabs from './VersionTabs';
import { V1_PARAMS, V2_PARAMS } from './params';
import { REST_RESPONSE, REST_V2_RESPONSE, restRequest, restV2Request } from './examples';
import type { RestVersion } from './types';

export default function RestSection({
  version,
  onVersionChange,
  restUrl,
  restV2Url,
  openApiUrl,
  paramDocs,
}: {
  version: RestVersion;
  onVersionChange: (next: RestVersion) => void;
  restUrl: string;
  restV2Url: string;
  openApiUrl: string;
  paramDocs: Record<string, string>;
}) {
  const versionUrl = version === 'v2' ? restV2Url : restUrl;

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
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Version 2 is a full rates endpoint in its own right, not a variant of version
            1. It takes the same filters, returns the complete record for every rate with
            no fields trimmed, and applies no staleness window — where version 1 leaves
            out any rate that has not been updated in over a week.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            All rates are expressed per 1 USD. Version 2 returns them as{' '}
            <code>{'{ base, rates, info }'}</code>, converted to whichever currency you
            name in <code>base</code> — pass <code>base=USD</code> to get them as stored.
            The base currency is left out of the results, as its rate against itself is
            always 1.
          </Typography>

          <Typography variant="h6" gutterBottom>Parameters</Typography>
          <Box sx={{ mb: 3 }}>
            <ParamList names={V2_PARAMS} docs={paramDocs} required={['base']} />
          </Box>

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
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            All rates are expressed per 1 USD. Version 1 returns them as{' '}
            <code>{'{ USD, info }'}</code>, and leaves out any rate that has not been
            updated in over a week.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Fields are trimmed to what the request asks for: <code>name</code> and{' '}
            <code>url</code> are returned only when <code>prefer</code> is absent, and{' '}
            <code>last_rate</code> only with <code>extra</code>. Version 2 always returns
            all of them.
          </Typography>

          <Typography variant="h6" gutterBottom>Parameters</Typography>
          <Box sx={{ mb: 3 }}>
            <ParamList names={V1_PARAMS} docs={paramDocs} />
          </Box>

          <Typography variant="h6" gutterBottom>Request</Typography>
          <Box sx={{ mb: 3 }}>
            <CodeBlock language="bash" code={restRequest(restUrl)} />
          </Box>

          <Typography variant="h6" gutterBottom>Response</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
            This request sets <code>prefer</code>, so <code>name</code> and{' '}
            <code>url</code> are not included.
          </Typography>
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
