import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface Props {
  title: string;
  /** One line saying what is plotted and how to read it. */
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Optional text under the chart, for caveats about the figures. */
  footnote?: ReactNode;
}

export default function ChartCard({ title, subtitle, action, children, footnote }: Props) {
  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ px: 2.5, pt: 2.25 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Box sx={{ px: 1.5, pt: 1, pb: footnote ? 0 : 1.5, flexGrow: 1 }}>{children}</Box>
      {footnote && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2.5, pb: 2 }}>
          {footnote}
        </Typography>
      )}
    </Paper>
  );
}
