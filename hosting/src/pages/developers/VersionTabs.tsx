import { Tab, Tabs } from '@mui/material';
import type { RestVersion } from './types';

/**
 * Rendered in both the REST and JSONP sections over one piece of state, so the
 * two can never show different versions — and neither silently reflects a
 * choice made in a section that is scrolled off screen.
 *
 * v2 leads because it is the more capable endpoint, not because v1 is on the
 * way out. Both are supported, and the copy in each tab says so.
 */
export default function VersionTabs({
  value,
  onChange,
  idPrefix,
}: {
  value: RestVersion;
  onChange: (next: RestVersion) => void;
  idPrefix: string;
}) {
  return (
    <Tabs
      value={value}
      onChange={(_event, next: RestVersion) => onChange(next)}
      aria-label="REST api version"
      sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
    >
      <Tab label="v2" value="v2" id={`${idPrefix}-tab-v2`} aria-controls={`${idPrefix}-panel-v2`} />
      <Tab label="v1" value="v1" id={`${idPrefix}-tab-v1`} aria-controls={`${idPrefix}-panel-v1`} />
    </Tabs>
  );
}
