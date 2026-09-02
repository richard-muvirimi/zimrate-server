import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField,
} from '@mui/material';
import { addCustomRate, currencyExists } from '../store/rates';

/**
 * Collects a currency the API does not carry, so the user can track a rate of
 * their own — the app's FragmentCustomRate. It enters the list like any other
 * rate, and a refresh leaves it alone.
 */
export default function AddCustomRateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<{ code?: string; rate?: string }>({});

  const close = () => {
    setCode('');
    setName('');
    setRate('');
    setError({});
    onClose();
  };

  const save = () => {
    const currency = code.trim().toUpperCase();
    const value = Number(rate);

    if (!currency) return setError({ code: 'Enter a currency code' });
    if (currencyExists(currency)) return setError({ code: `${currency} is already in the list` });
    if (!Number.isFinite(value) || value <= 0) return setError({ rate: 'Enter a rate above zero' });

    addCustomRate(currency, name, value);
    close();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Add your own rate</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body2" sx={{ mb: 2 }}>
          For a currency the API does not quote. Enter how many units one US dollar buys.
        </DialogContentText>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Currency code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            error={Boolean(error.code)}
            helperText={error.code}
            size="small"
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { maxLength: 6, style: { textTransform: 'uppercase' } } }}
          />
          <TextField
            label="Name (optional)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Rate per US dollar"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            error={Boolean(error.rate)}
            helperText={error.rate}
            size="small"
            fullWidth
            type="number"
            slotProps={{ htmlInput: { inputMode: 'decimal', min: 0 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button onClick={save} variant="contained">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
