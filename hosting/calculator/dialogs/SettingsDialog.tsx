import { useSyncExternalStore } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  FormHelperText, InputLabel, MenuItem, Select,
} from '@mui/material';
import {
  AGGREGATES, getRatesState, setAggregate, subscribeRates, type Aggregate,
} from '../store/rates';

const DESCRIPTIONS: Record<Aggregate, string> = {
  min: 'The lowest rate any source is quoting',
  max: 'The highest rate any source is quoting',
  mean: 'The average across every source',
  median: 'The middle rate, ignoring outliers',
  mode: 'The rate the most sources agree on',
  random: 'One source picked at random',
};

/**
 * The app's `preferred_currency` setting: which aggregate the API is asked for
 * when several sources quote the same currency.
 */
export default function SettingsDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { aggregate } = useSyncExternalStore(subscribeRates, getRatesState, getRatesState);

  const change = (next: Aggregate) => {
    if (next === aggregate) return;
    setAggregate(next);
    // The stored rates were fetched under the old aggregate, so they are now
    // the wrong numbers — pull them again rather than leaving a mismatch.
    onChanged();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel>Rate to use</InputLabel>
          <Select
            value={aggregate}
            label="Rate to use"
            onChange={(event) => change(event.target.value as Aggregate)}
          >
            {AGGREGATES.map((option) => (
              <MenuItem key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {DESCRIPTIONS[aggregate]}. Several sites are scraped for each currency; this picks
            which of their rates you see.
          </FormHelperText>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
