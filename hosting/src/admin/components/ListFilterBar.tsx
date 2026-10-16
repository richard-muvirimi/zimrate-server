import type { ReactNode } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';

export interface ActiveFilter {
  label: string;
  onDelete: () => void;
}

interface ListFilterBarProps {
  children: ReactNode;
  /** One entry per filter in use; falsy entries are skipped, so pages can write `cond && {…}`. */
  active: (ActiveFilter | false | null | undefined | '')[];
  onClear: () => void;
}

/**
 * The filter card every list page uses: a "Filters" header with the number in
 * use and Clear all, the page's own controls, and a removable chip per filter in
 * use. Pages supply the controls and describe what is active; the card draws the
 * rest, so no page can drift from the others.
 */
export default function ListFilterBar({ children, active, onClear }: ListFilterBarProps) {
  const inUse = active.filter((f): f is ActiveFilter => !!f);

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <FilterListIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Filters</Typography>
        {inUse.length > 0 && (
          <>
            <Chip label={inUse.length} size="small" color="primary" sx={{ height: 18, fontSize: '0.7rem', minWidth: 22 }} />
            <Box sx={{ ml: 'auto !important' }}>
              <Chip label="Clear all" size="small" icon={<FilterListOffIcon />} onClick={onClear} variant="outlined" />
            </Box>
          </>
        )}
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {children}
      </Box>

      {inUse.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {inUse.map((f) => <Chip key={f.label} label={f.label} size="small" onDelete={f.onDelete} />)}
        </Stack>
      )}
    </Paper>
  );
}
