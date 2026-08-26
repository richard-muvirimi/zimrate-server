import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Box component="main">{children}</Box>
      <Footer />
    </Box>
  );
}