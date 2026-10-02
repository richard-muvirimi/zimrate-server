import { ToggleButton, ToggleButtonGroup } from '@mui/material';

/** The aggregations the API exposes, in the order the rates table lists them. */
const AGGREGATES = [
  { key: 'max', label: 'Max', hint: 'The highest rate any source is quoting' },
  { key: 'mean', label: 'Mean', hint: 'The average across every source' },
  { key: 'min', label: 'Min', hint: 'The lowest rate any source is quoting' },
  { key: 'median', label: 'Median', hint: 'The middle rate, ignoring outliers' },
  { key: 'mode', label: 'Mode', hint: 'The rate the most sources agree on' },
  { key: 'random', label: 'Random', hint: 'One source picked at random' },
] as const;
export type Aggregate = (typeof AGGREGATES)[number]['key'];

const RANGE = { key: 'range', label: 'Range', hint: 'The lowest to the highest rate across sources' };

/** Segmented switch: one track, the chosen aggregate raised within it. */
export default function AggregateSwitch<T extends Aggregate | 'range'>({
  value,
  onChange,
  disabled,
  range,
}: {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Leads with a "Range" option, for views that can show min–max. */
  range?: boolean;
}) {
  const options: readonly { key: string; label: string; hint: string }[] = range
    ? [RANGE, ...AGGREGATES]
    : AGGREGATES;

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      disabled={disabled}
      // Clicking the active option passes null; keep the current choice.
      onChange={(_, next: T | null) => next && onChange(next)}
      color="primary"
      size="small"
      aria-label={range ? 'Rate to show' : 'Rate to convert with'}
      // Too narrow for one row on phones: an even 3×2 grid there rather
      // than a wrapped pill with one option stranded on the second line.
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: `repeat(${options.length}, auto)` },
        gap: 0.25,
        p: 0.375,
        borderRadius: { xs: '14px', sm: '999px' },
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        '& .MuiToggleButtonGroup-grouped': {
          border: 0,
          borderRadius: 999,
          m: 0,
          px: 1.25,
          py: 0.375,
          textTransform: 'none',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'text.secondary',
          '&.Mui-selected': { color: 'primary.main' },
        },
      }}
    >
      {options.map(({ key, label, hint }) => (
        <ToggleButton
          key={key}
          value={key}
          title={hint}
          // On phones Range takes its own row so the aggregates stay a 3×2 grid.
          sx={key === RANGE.key ? { gridColumn: { xs: '1 / -1', sm: 'auto' } } : undefined}
        >
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
