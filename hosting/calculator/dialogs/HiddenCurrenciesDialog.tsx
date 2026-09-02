import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem,
  ListItemText, Typography,
} from '@mui/material';
import { setHidden, type StoredRate } from '../store/rates';
import { currencyLabel } from '../currency';

/** Brings back a currency swiped out of the list — the app's FragmentHiddenRates. */
export default function HiddenCurrenciesDialog({
  open,
  hidden,
  onClose,
}: {
  open: boolean;
  hidden: StoredRate[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Hidden currencies</DialogTitle>
      <DialogContent dividers>
        {hidden.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing is hidden.
          </Typography>
        ) : (
          <List dense disablePadding>
            {hidden.map((rate) => (
              <ListItem
                key={rate.currency}
                disableGutters
                secondaryAction={
                  <Button size="small" onClick={() => setHidden(rate.currency, false)}>
                    Restore
                  </Button>
                }
              >
                <ListItemText primary={currencyLabel(rate.currency, rate.name)} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
