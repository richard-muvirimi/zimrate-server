import { memo } from 'react';
import {
  Box, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import type { StoredRate } from './store/rates';
import { BASE_CURRENCY, currencyLabel, flagUrl } from './currency';
import { relativeTime } from './format';

interface Props {
  rate: StoredRate;
  /** What the rate field shows — the user's override when they have typed one. */
  rateText: string;
  /** What the amount field shows — raw text on the active row, computed elsewhere. */
  amountText: string;
  onRateChange: (value: string) => void;
  onRateCommit: () => void;
  onAmountChange: (value: string) => void;
  onTogglePin: () => void;
  onHide: () => void;
  onRefresh: () => void;
  onDelete: () => void;
}

function RateRow({
  rate, rateText, amountText,
  onRateChange, onRateCommit, onAmountChange,
  onTogglePin, onHide, onRefresh, onDelete,
}: Props) {
  const isBase = rate.currency === BASE_CURRENCY;
  const flag = flagUrl(rate.currency, rate.custom);
  const checked = relativeTime(rate.last_updated ?? rate.last_checked);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        bgcolor: 'background.elevated',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {flag ? (
          <Box
            component="img"
            src={flag}
            alt=""
            width={28}
            height={21}
            sx={{ borderRadius: 0.5, flexShrink: 0, objectFit: 'cover' }}
            // A currency whose flag is not deployed (or not yet cached offline)
            // falls back to the generic mark rather than a broken image.
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden';
            }}
          />
        ) : (
          <PaidOutlinedIcon sx={{ width: 28, color: 'text.secondary', flexShrink: 0 }} />
        )}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {currencyLabel(rate.currency, rate.name)}
          </Typography>
          {checked && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {checked}
            </Typography>
          )}
        </Box>

        <Tooltip title={isBase ? 'The base currency is always first' : rate.pinned ? 'Unfavourite' : 'Favourite'}>
          {/* A span keeps the tooltip working while the button is disabled. */}
          <span>
            <IconButton size="small" onClick={onTogglePin} disabled={isBase} aria-label="Favourite">
              {rate.pinned ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>

        {/* Nothing to re-fetch for a rate the user owns, so the same slot deletes it. */}
        {rate.custom ? (
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} aria-label="Delete">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Refresh this rate">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={isBase} aria-label="Refresh">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        <Tooltip title={isBase ? 'The base currency cannot be hidden' : 'Hide'}>
          <span>
            <IconButton size="small" onClick={onHide} disabled={isBase} aria-label="Hide">
              <VisibilityOffIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1}>
        <TextField
          label="Rate"
          value={rateText}
          onChange={(event) => onRateChange(event.target.value)}
          onBlur={onRateCommit}
          // USD is the base at 1 — there is nothing to override.
          disabled={isBase}
          size="small"
          fullWidth
          type="number"
          slotProps={{
            htmlInput: { inputMode: 'decimal', min: 0 },
            input: {
              // The rate is how many of this currency one dollar buys, so the
              // unit belongs after it — a leading "$" read as a dollar amount.
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="text.secondary" noWrap>
                    per $
                  </Typography>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          label="Amount"
          value={amountText}
          onChange={(event) => onAmountChange(event.target.value)}
          size="small"
          fullWidth
          type="number"
          slotProps={{
            htmlInput: { inputMode: 'decimal', min: 0 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="caption" color="text.secondary">
                    {rate.currency}
                  </Typography>
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
    </Paper>
  );
}

// The list re-renders on every keystroke in any row, so rows that did not change
// should not re-render with it.
export default memo(RateRow);
