import { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton,
  Drawer, List, ListItemButton, ListItemText, Box, useMediaQuery, useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink } from 'react-router-dom';
import ColorModeToggle from './ColorModeToggle';
import logoUrl from '../assets/logo.svg';
import { useBranding } from '../useBranding';

const navLinks = [
  { label: 'Rates', to: '/#rates' },
  { label: 'Features', to: '/#features' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Apps', to: '/#apps' },
  { label: 'Developers', to: '/developers' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

export default function Header() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const branding = useBranding();

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ px: { xs: 2, md: 6 }, maxWidth: 1200, width: '100%', mx: 'auto' }}>
        <Box
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            textDecoration: 'none',
          }}
        >
          {/* Explicit dimensions avoid layout shift. Falls back to the bundled
              mark until a custom icon has been uploaded. */}
          <Box
            component="img"
            src={branding.icon_url || logoUrl}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoUrl; }}
            alt=""
            width={24}
            height={27}
            sx={{ objectFit: 'contain' }}
          />
          <Typography variant="h6" fontWeight={700} color="primary">
            {/* Blank until branding loads; the cache makes that a first-visit
                only case, and the logo still anchors the header. */}
            {branding.app_name}
          </Typography>
        </Box>

        {isMobile ? (
          <>
            <ColorModeToggle />
            <IconButton onClick={() => setDrawerOpen(true)} color="inherit">
              <MenuIcon />
            </IconButton>
            <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
              <Box sx={{ width: 240, pt: 2 }}>
                <List>
                  {navLinks.map(({ label, to }) => (
                    <ListItemButton key={label} component={RouterLink} to={to} onClick={() => setDrawerOpen(false)}>
                      <ListItemText primary={label} />
                    </ListItemButton>
                  ))}
                  <ListItemButton component={RouterLink} to="/admin/login" onClick={() => setDrawerOpen(false)}>
                    <ListItemText primary="Admin" />
                  </ListItemButton>
                </List>
              </Box>
            </Drawer>
          </>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {navLinks.map(({ label, to }) => (
              <Button key={label} component={RouterLink} to={to} color="inherit" size="small">
                {label}
              </Button>
            ))}
            <ColorModeToggle />
            <Button
              component={RouterLink}
              to="/admin/login"
              variant="outlined"
              size="small"
              sx={{ ml: 1 }}
            >
              Admin
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
