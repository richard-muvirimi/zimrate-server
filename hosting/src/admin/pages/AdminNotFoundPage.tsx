import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function AdminNotFoundPage() {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Page not found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        That admin page doesn't exist.
      </Typography>
      <Button variant="outlined" component={RouterLink} to="/admin">
        Back to dashboard
      </Button>
    </Box>
  );
}
