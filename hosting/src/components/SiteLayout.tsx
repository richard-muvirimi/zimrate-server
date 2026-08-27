import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import ForkRibbon from './ForkRibbon';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Public pages only — SiteLayout doesn't wrap the admin area. */}
      <ForkRibbon />
      <Header />
      <Box component="main">{children}</Box>
      <Footer />
    </Box>
  );
}