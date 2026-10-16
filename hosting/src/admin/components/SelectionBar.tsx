import type { ReactNode } from 'react';
import { alpha, Box, Button, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface SelectionBarProps {
  count: number;
  onClear: () => void;
  /** The bulk actions, as small buttons. */
  children: ReactNode;
}

/**
 * The bar a list page shows above its table while rows are ticked: how many,
 * the actions that apply to them, and a way to untick them all.
 */
export default function SelectionBar({ count, onClear, children }: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      sx={{
        px: 2,
        py: 1,
        mb: 1,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
      }}
    >
      <Typography variant="subtitle2" sx={{ mr: 1 }}>{count} selected</Typography>
      {children}
      <Box sx={{ ml: 'auto' }}>
        <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={onClear}>
          Clear selection
        </Button>
      </Box>
    </Stack>
  );
}
