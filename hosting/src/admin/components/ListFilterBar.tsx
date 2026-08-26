import type { ReactNode } from 'react';
import { Box, Button, Paper } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

interface ListFilterBarProps {
  children: ReactNode;
  /** Number of filters currently applied; drives the clear button. */
  activeCount: number;
  onClear: () => void;
}

/** Layout shell for a list page's filter controls. Each page supplies its own. */
export default function ListFilterBar({ children, activeCount, onClear }: ListFilterBarProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      {children}
      {activeCount > 0 && (
        <Box sx={{ ml: 'auto' }}>
          <Button size="small" startIcon={<ClearIcon />} onClick={onClear}>
            Clear filters ({activeCount})
          </Button>
        </Box>
      )}
    </Paper>
  );
}
