import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import { RedocStandalone } from 'redoc';
import { parse as parseYaml } from 'yaml';
import type { RestVersion } from './types';

/** Brand blue, readable on Redoc's white canvas. */
const REDOC_PRIMARY = '#0B6FD0';

/**
 * Renders only the selected version's operations from the single OpenAPI file.
 *
 * Redoc used to fetch the spec itself via specUrl. Fetching it here instead is
 * what allows filtering — but it also means the failure path is now ours, so it
 * is surfaced rather than left as a blank panel.
 */
export default function SpecPanel({
  openApiUrl,
  version,
}: {
  openApiUrl: string;
  version: RestVersion;
}) {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(openApiUrl)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        if (!cancelled) setSpec(parseYaml(text) as Record<string, unknown>);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [openApiUrl]);

  // components stays whole — Redoc only renders schemas reachable from the
  // paths it is given, so the unused ones cost nothing.
  const versionSpec = useMemo(() => {
    if (!spec) return null;
    const paths = (spec.paths ?? {}) as Record<string, unknown>;
    // Matched rather than constructed: v2's key carries a templated segment
    // (/v2/{base}), so building `/${version}` finds nothing and the panel would
    // silently sit on its spinner.
    const path = Object.keys(paths).find(
      (candidate) => candidate === `/${version}` || candidate.startsWith(`/${version}/`),
    );
    if (!path) return null;

    // Redoc prints "title (info.version)". Unfiltered that is the specification
    // document's own version, which reads as an api version and contradicts the
    // tab — "1.1.0" above the v2 operations looks like v1. In a per-version view
    // the api version is the useful thing to show, so the document version moves
    // into the description rather than being dropped.
    const info = (spec.info ?? {}) as Record<string, unknown>;
    return {
      ...spec,
      info: {
        ...info,
        version,
        description: `${info.description ?? ''} Showing the ${version} operations, from specification document ${info.version ?? 'unknown'}.`.trim(),
      },
      paths: { [path]: paths[path] },
    };
  }, [spec, version]);

  return (
    // Redoc renders light-only, so this container is pinned white in both
    // schemes rather than inheriting the surface token.
    <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden', bgcolor: 'common.white' }}>
      <Box sx={{ height: { xs: 900, md: 1200 }, overflowY: 'auto', bgcolor: 'common.white' }}>
        {error ? (
          <Box sx={{ p: 4 }}>
            <Typography color="error" gutterBottom>
              The specification could not be loaded ({error}).
            </Typography>
            <Box component="a" href={openApiUrl} target="_blank" rel="noopener" sx={{ color: REDOC_PRIMARY }}>
              Open the raw specification file
            </Box>
          </Box>
        ) : versionSpec ? (
          <RedocStandalone
            // Remount on version change so no operation from the previously
            // selected version survives in the panel.
            key={version}
            spec={versionSpec}
            options={{
              hideDownloadButton: true,
              expandResponses: '200,201',
              nativeScrollbars: true,
              theme: { colors: { primary: { main: REDOC_PRIMARY } } },
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Paper>
  );
}
