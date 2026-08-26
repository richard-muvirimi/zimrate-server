import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

/**
 * Suspense fallback that stays blank for a beat before showing a spinner, so a
 * fast chunk load doesn't flash. The fixed height reserves space to stop the
 * layout jumping when the real content arrives.
 */
export default function RouteFallback({ minHeight = '100vh' }: { minHeight?: string | number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(id);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
      }}
    >
      {visible && <CircularProgress />}
    </Box>
  );
}
