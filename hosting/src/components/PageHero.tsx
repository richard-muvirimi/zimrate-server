import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function PageHero({ eyebrow, title, description, actions }: PageHeroProps) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 6 },
        pt: { xs: 7, md: 10 },
        pb: { xs: 5, md: 7 },
        borderBottom: '1px solid', borderBottomColor: 'divider',
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid', borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
          px: { xs: 3, md: 5 },
          py: { xs: 4, md: 5 },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -28,
            right: -28,
            width: 112,
            height: 112,
            border: '1px solid rgba(15, 138, 253, 0.28)',
            borderRadius: 3,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -20,
            left: -20,
            width: 84,
            height: 84,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
          },
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 760, position: 'relative', zIndex: 1 }}>
          {eyebrow ? <Chip label={eyebrow} color="primary" sx={{ width: 'fit-content' }} /> : null}
          <Typography variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3.5rem' }, lineHeight: 1.05 }}>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, fontSize: '1.05rem' }}>
            {description}
          </Typography>
          {actions ? <Box>{actions}</Box> : null}
        </Stack>
      </Box>
    </Box>
  );
}