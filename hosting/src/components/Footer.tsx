import { Box, Typography, Link, Stack, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { useBranding } from '../useBranding';
import { DateTime } from 'luxon';
import SafeEmail from './SafeEmail';

export default function Footer() {
  const year = DateTime.now().year;
  const branding = useBranding();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.subtle',
        borderTop: '1px solid', borderTopColor: 'divider',
        py: 6,
        px: { xs: 2, md: 6 },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={3}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
              <Box
                component="img"
                src={branding.icon_url || logoUrl}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoUrl; }}
                alt=""
                width={22}
                height={25}
                sx={{ objectFit: `contain` }}
              />
              <Typography variant="h6" fontWeight={700} color="primary">
                {branding.app_name}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" maxWidth={320}>
              Free, real-time Zimbabwe exchange rates aggregated from multiple sources and served via a simple API.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 4 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                API
              </Typography>
              <Stack spacing={0.5}>
                <Link component={RouterLink} to="/developers" color="text.secondary" underline="hover" variant="body2">Developers</Link>
                <Link href="/docs/documentation.yaml" color="text.secondary" underline="hover" variant="body2">OpenAPI Spec</Link>
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Project
              </Typography>
              <Stack spacing={0.5}>
                <Link component={RouterLink} to="/faq" color="text.secondary" underline="hover" variant="body2">FAQ</Link>
                <Link component={RouterLink} to="/contact" color="text.secondary" underline="hover" variant="body2">Contact</Link>
                <Link component={RouterLink} to="/privacy" color="text.secondary" underline="hover" variant="body2">Privacy</Link>
                <Link component={RouterLink} to="/delete-account" color="text.secondary" underline="hover" variant="body2">Delete account</Link>
                {branding.repo_url && (
                  <Link href={branding.repo_url} target="_blank" rel="noopener" color="text.secondary" underline="hover" variant="body2">GitHub</Link>
                )}
                <Link component={RouterLink} to="/admin/login" color="text.secondary" underline="hover" variant="body2">Admin</Link>
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Apps
              </Typography>
              <Stack spacing={0.5}>
                <Link href="https://play.google.com/store/apps/details?id=com.tyganeutronics.myratecalculator" target="_blank" rel="noopener" color="text.secondary" underline="hover" variant="body2">Android app</Link>
                <Link href="https://wordpress.org/plugins/zimrate" target="_blank" rel="noopener" color="text.secondary" underline="hover" variant="body2">WordPress plugin</Link>
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Contact
              </Typography>
              <Stack spacing={0.5}>
                {branding.author_email && (
                  <SafeEmail email={branding.author_email} label="Email" color="text.secondary" underline="hover" variant="body2" />
                )}
                {branding.author_url && (
                  <Link href={branding.author_url} target="_blank" rel="noopener" color="text.secondary" underline="hover" variant="body2">Website</Link>
                )}
              </Stack>
            </Box>
          </Stack>
        </Stack>

        <Divider sx={{ my: 4 }} />

        <Typography variant="caption" color="text.secondary" align="center" display="block">
          {/* Every part is optional so a cleared field never leaves stray words. */}
          © {year}
          {branding.app_name ? ` ${branding.app_name}` : ''}
          {branding.author_name ? ` by ${branding.author_name}` : ''}
          {' '}— Free to use, no attribution required.
        </Typography>
      </Box>
    </Box>
  );
}
