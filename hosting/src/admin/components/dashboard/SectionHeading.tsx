import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

export default function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: 2 }}
    >
      <Typography variant="h6" fontWeight={700}>{title}</Typography>
      {children}
    </Stack>
  );
}
