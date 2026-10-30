import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Tab, Tabs, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useColorScheme } from '@mui/material/styles';
import type { RestVersion } from './types';
import LinkifiedText from '../../components/LinkifiedText';

// Scalar is by far the heaviest dependency on this page — statically imported it
// would be most of the DevelopersPage chunk. Nothing can render it until the spec
// has been fetched and parsed, so it is loaded alongside that fetch instead. The
// package's js does not import its own stylesheet, so it is loaded here too.
const ApiReferenceReact = lazy(() =>
  Promise.all([
    import('@scalar/api-reference-react'),
    import('@scalar/api-reference-react/style.css'),
  ]).then(([mod]) => ({ default: mod.ApiReferenceReact })),
);

// Accent and font follow the site's theme rather than Scalar's own, and the
// site font replaces the one Scalar would otherwise fetch from its CDN.
const SCALAR_CSS = `.scalar-app {
  --scalar-color-accent: var(--mui-palette-primary-main);
  --scalar-font: "IBM Plex Sans", sans-serif;
}`;

/** Every version documents both; each tab shows one so the panel needs no sidebar. */
const METHODS = ['get', 'post'] as const;
type Method = (typeof METHODS)[number];

type Json = Record<string, unknown>;

/**
 * Scalar's code samples send every optional parameter that has an example,
 * which builds requests the api rejects (search and name together) or answers
 * as JSONP (callback). Samples should carry only what is required, so those
 * examples are marked x-disabled, which leaves them unticked rather than
 * hidden, and the form body gets an empty example instead of one generated
 * from every property. Optional parameters without an example Scalar already
 * leaves out.
 */
function withRequiredOnly(operation: Json): Json {
  const parameters = ((operation.parameters ?? []) as Json[]).map((parameter) => {
    if (parameter.required || parameter.example === undefined) return parameter;
    const { example, ...rest } = parameter;
    return { ...rest, examples: { default: { value: example, 'x-disabled': true } } };
  });

  const requestBody = operation.requestBody as Json | undefined;
  const content = (requestBody?.content ?? {}) as Record<string, Json>;
  return {
    ...operation,
    parameters,
    ...(requestBody && {
      requestBody: {
        ...requestBody,
        content: Object.fromEntries(
          Object.entries(content).map(([type, media]) => [type, { ...media, example: {} }]),
        ),
      },
    }),
  };
}

/**
 * Renders only the selected version's operations from the single OpenAPI file.
 *
 * Scalar can fetch the spec itself from a url. Fetching it here instead is
 * what allows filtering — but it also means the failure path is now ours, so it
 * is surfaced rather than left as a blank panel.
 */
export default function SpecPanel({
  openApiUrl,
  postmanUrl,
  version,
}: {
  openApiUrl: string;
  postmanUrl: string;
  version: RestVersion;
}) {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<Method>('get');
  const { mode, systemMode } = useColorScheme();
  const darkMode = (mode === 'system' ? systemMode : mode) !== 'light';

  useEffect(() => {
    let cancelled = false;
    fetch(openApiUrl)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(async (text) => {
        // yaml is only ever needed for this one parse, so it rides along in the
        // fetched-spec path rather than in the page chunk.
        const { parse: parseYaml } = await import('yaml');
        if (!cancelled) setSpec(parseYaml(text) as Record<string, unknown>);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [openApiUrl]);

  // components stays whole — Scalar only renders schemas reachable from the
  // paths it is given, so the unused ones cost nothing.
  const operationSpec = useMemo(() => {
    if (!spec) return null;
    const paths = (spec.paths ?? {}) as Record<string, unknown>;
    // Matched rather than constructed: v2's key carries a templated segment
    // (/v2/{base}), so building `/${version}` finds nothing and the panel would
    // silently sit on its spinner.
    const path = Object.keys(paths).find(
      (candidate) => candidate === `/${version}` || candidate.startsWith(`/${version}/`),
    );
    if (!path) return null;

    // Scalar prints info.version beside the title. Unfiltered that is the specification
    // document's own version, which reads as an api version and contradicts the
    // tab — "1.1.0" above the v2 operations looks like v1. In a per-version view
    // the api version is the useful thing to show, so the document version moves
    // into the description rather than being dropped.
    const info = (spec.info ?? {}) as Record<string, unknown>;
    // Only the selected method is kept. Parameters are declared per operation
    // in this spec, never on the path item, so nothing else needs carrying over.
    const pathItem = paths[path] as Record<string, Json>;
    return {
      ...spec,
      info: {
        ...info,
        version,
        description: `${info.description ?? ''} Showing the ${version} ${method.toUpperCase()} operation, from specification document ${info.version ?? 'unknown'}.`.trim(),
      },
      paths: { [path]: { [method]: withRequiredOnly(pathItem[method]) } },
    };
  }, [spec, version, method]);

  // Shown both while the spec is being fetched and while Scalar's own chunk is
  // still in flight — from the reader's side they are the same wait.
  const spinner = (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    // Padded card with a rounded embed inside, matching the GraphQL and JSONP
    // playgrounds.
    <Paper sx={{ p: 2, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={method} onChange={(_event, next: Method) => setMethod(next)} aria-label="HTTP method">
          {METHODS.map((m) => (
            <Tab key={m} label={m.toUpperCase()} value={m} id={`spec-tab-${m}`} aria-controls="spec-panel" />
          ))}
        </Tabs>
        <Button
          component="a"
          href={postmanUrl}
          download
          size="small"
          endIcon={<DownloadIcon />}
          sx={{ ml: 'auto' }}
        >
          Postman Collection
        </Button>
      </Box>
      <Box
        role="tabpanel"
        id="spec-panel"
        aria-labelledby={`spec-tab-${method}`}
        sx={{ height: { xs: 900, md: 1200 }, overflowY: 'auto', borderRadius: 2 }}
      >
        {error ? (
          <Box sx={{ p: 4 }}>
            <Typography color="error" gutterBottom>
              The specification could not be loaded (<LinkifiedText>{error}</LinkifiedText>).
            </Typography>
            <Box component="a" href={openApiUrl} target="_blank" rel="noopener" sx={{ color: 'primary.main' }}>
              Open the raw specification file
            </Box>
          </Box>
        ) : operationSpec ? (
          <Suspense fallback={spinner}>
            <ApiReferenceReact
              // Remount on either tab change so no operation from the previous
              // selection survives in the panel.
              key={`${version}-${method}`}
              configuration={{
                content: operationSpec,
                showSidebar: false,
                documentDownloadType: 'none',
                // The site's own toggle decides the scheme; a second toggle
                // inside the panel could only disagree with it.
                forceDarkModeState: darkMode ? 'dark' : 'light',
                hideDarkModeToggle: true,
                // The panel is one section of a longer page with its own
                // anchors, so Scalar must not rewrite the page's url or history.
                urlRouting: false,
                withDefaultFonts: false,
                customCss: SCALAR_CSS,
              }}
            />
          </Suspense>
        ) : (
          spinner
        )}
      </Box>
    </Paper>
  );
}
