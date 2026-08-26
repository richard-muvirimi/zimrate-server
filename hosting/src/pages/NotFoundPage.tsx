import { Box, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout';
import PageHero from '../components/PageHero';

export default function NotFoundPage() {
  return (
    <SiteLayout>
      <Box sx={{ minHeight: '70vh', bgcolor: 'background.default' }}>
        <PageHero
          eyebrow="404"
          title="Page not found"
          description="That page doesn't exist, or it moved. The rates, the docs and the FAQ are all still here."
          actions={
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" component={RouterLink} to="/">
                Back to home
              </Button>
              <Button variant="outlined" component={RouterLink} to="/developers">
                API docs
              </Button>
            </Stack>
          }
        />
      </Box>
    </SiteLayout>
  );
}
