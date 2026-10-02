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

/** Segmented switch: one track, the chosen aggregate raised within it. */
export default function AggregateSwitch({
  value,
  onChange,
  disabled,
}: {
  value: Aggregate;
  onChange: (value: Aggregate) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      disabled={disabled}
      // Clicking the active option passes null; keep the current choice.
      onChange={(_, next: Aggregate | null) => next && onChange(next)}
      color="primary"
      size="small"
      aria-label="Rate to convert with"
      // Too narrow for one row on phones: an even 3×2 grid there rather
      // than a wrapped pill with one option stranded on the second line.
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, auto)' },
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
      {AGGREGATES.map(({ key, label, hint }) => (
        <ToggleButton key={key} value={key} title={hint}>
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
