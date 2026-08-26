import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface PaginationBarProps {
  page: number;
  rangeStart: number;
  rangeEnd: number;
  total: number | null;
  hasPrev: boolean;
  hasNext: boolean;
  loading?: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Plural noun for the caption, e.g. "rates". */
  label?: string;
}

/**
 * First / previous / next only.
 *
 * Deliberately not MUI's TablePagination: that assumes a known total and
 * arbitrary page jumps, neither of which cursor paging can provide — there is
 * no cursor for page N without walking every page before it.
 */
export default function PaginationBar({
  page,
  rangeStart,
  rangeEnd,
  total,
  hasPrev,
  hasNext,
  loading = false,
  onFirst,
  onPrev,
  onNext,
  label = 'records',
}: PaginationBarProps) {
  const caption =
    rangeEnd === 0
      ? `No ${label}`
      : `Showing ${rangeStart}–${rangeEnd}${total != null ? ` of ${total}` : ''} ${label}`;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderTopColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Page {page}
        </Typography>
        <Tooltip title="First page">
          <Box component="span">
            <IconButton size="small" onClick={onFirst} disabled={loading || !hasPrev}>
              <FirstPageIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        <Tooltip title="Previous page">
          <Box component="span">
            <IconButton size="small" onClick={onPrev} disabled={loading || !hasPrev}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        <Tooltip title="Next page">
          <Box component="span">
            <IconButton size="small" onClick={onNext} disabled={loading || !hasNext}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
