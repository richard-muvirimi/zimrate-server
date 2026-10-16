import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Stack, Typography } from '@mui/material';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  icon: ReactNode;
  to?: string;
  tone?: 'default' | 'warning' | 'good';
}

const TONE = { default: 'primary', warning: 'warning', good: 'success' } as const;

export default function StatTile({ label, value, caption, icon, to, tone = 'default' }: StatTileProps) {
  const color = TONE[tone];

  return (
    <Paper
      {...(to ? { component: RouterLink, to } : {})}
      sx={{
        p: 2.25,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        textDecoration: 'none',
        border: '1px solid',
        borderColor: tone === 'warning' ? 'warning.main' : 'divider',
        borderRadius: 3,
        transition: 'border-color 0.2s, transform 0.2s',
        ...(to && { '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }),
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: `${color}.main`,
            bgcolor: 'color-mix(in srgb, currentColor 12%, transparent)',
            '& svg': { fontSize: 18 },
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography variant="h4" component="p" fontWeight={700} lineHeight={1.1}>{value}</Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>{caption}</Typography>
      )}
    </Paper>
  );
}
