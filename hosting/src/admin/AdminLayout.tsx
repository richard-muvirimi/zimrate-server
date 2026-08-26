import { Suspense, useEffect, useState } from 'react';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Divider, Button, useMediaQuery, useTheme,
  Stack, Avatar, Alert,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SourceIcon from '@mui/icons-material/Source';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import MailIcon from '@mui/icons-material/Mail';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';
import RouteFallback from '../components/RouteFallback';
import ColorModeToggle from '../components/ColorModeToggle';
import { useBranding } from '../useBranding';
import PresetToggle from './components/PresetToggle';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { label: 'Rates', path: '/admin/rates', icon: <CurrencyExchangeIcon /> },
  { label: 'Sources', path: '/admin/sources', icon: <SourceIcon /> },
  { label: 'Users', path: '/admin/users', icon: <PeopleIcon /> },
  { label: 'Options', path: '/admin/options', icon: <SettingsIcon /> },
  { label: 'Email / SMTP', path: '/admin/smtp', icon: <MailIcon /> },
  { label: 'Branding', path: '/admin/branding', icon: <BrandingWatermarkIcon /> },
  { label: 'Import / Export', path: '/admin/import-export', icon: <ImportExportIcon /> },
];

export default function AdminLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const branding = useBranding();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(null);
        return;
      }
      // Surface whether the account actually carries the admin claim. Without
      // it Firestore reads and /api/admin/** both fail, and the errors give no
      // hint that the claim is the missing piece.
      try {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } catch {
        setIsAdmin(null);
      }
    });
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary"
          component={RouterLink}
          to="/"
          sx={{ textDecoration: 'none' }}
        >
          {branding.app_name ? `${branding.app_name} Admin` : 'Admin'}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, py: 1 }}>
        {navItems.map(({ label, path, icon }) => {
          const isActive = path === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(path);
          return (
            <ListItemButton
              key={path}
              component={RouterLink}
              to={path}
              selected={isActive}
              onClick={() => setMobileOpen(false)}
              sx={{
                mx: 1, borderRadius: 1, mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.dark',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        {user && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user.displayName ?? user.email}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {user.email}
            </Typography>
          </Box>
        )}
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          color="inherit"
          sx={{ justifyContent: 'flex-start' }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, textTransform: 'capitalize' }}>
            {navItems.find((n) =>
              n.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(n.path)
            )?.label ?? 'Admin'}
          </Typography>
          {user && (
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mr: 1 }}>
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                  {user.displayName ?? user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isAdmin === false ? 'No admin claim' : 'Administrator'}
                </Typography>
              </Box>
              <Avatar
                src={user.photoURL ?? undefined}
                sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.9rem' }}
              >
                {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
              </Avatar>
            </Stack>
          )}
          <PresetToggle />
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {drawer}
      </Drawer>

      {/* Permanent drawer on desktop.
          The docked root needs its own width and flexShrink: MUI renders the
          drawer paper as position:fixed, so without them the root collapses to
          zero width and the main content starts at x=0, underneath the sidebar. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px',
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        {isAdmin === false && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <strong>This account has no <code>admin</code> custom claim.</strong> Firestore reads
            and every <code>/api/admin</code> call will fail until it is granted — that is what
            "Missing or insufficient permissions" and "Admin access required" mean. Run{' '}
            <code>npm --prefix functions run set-admin -- {user?.email ?? 'you@example.com'}</code>{' '}
            then sign out and back in.
          </Alert>
        )}

        {/* Keeps the drawer and appbar mounted while the next admin chunk loads. */}
        <Suspense fallback={<RouteFallback minHeight="50vh" />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
