import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import AbcIcon from '@mui/icons-material/Abc';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

export type MatchMode = 'prefix' | 'exact';

type FilterTextFieldProps = TextFieldProps & {
  matchMode: MatchMode;
  onMatchModeChange: (mode: MatchMode) => void;
};

/** A filter text box with a button at its end that switches between starts-with and exact matching. */
export default function FilterTextField({ matchMode, onMatchModeChange, slotProps, ...rest }: FilterTextFieldProps) {
  return (
    <TextField
      {...rest}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={matchMode === 'exact' ? 'Exact match — click for starts-with' : 'Starts with — click for exact match'}>
                <IconButton
                  size="small"
                  edge="end"
                  onClick={() => onMatchModeChange(matchMode === 'exact' ? 'prefix' : 'exact')}
                  color={matchMode === 'prefix' ? 'primary' : 'default'}
                  aria-label="Toggle match mode"
                >
                  {matchMode === 'prefix' ? <AbcIcon fontSize="small" /> : <FormatQuoteIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
