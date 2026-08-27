import { Box } from '@mui/material';
import { useBranding } from '../useBranding';

/**
 * "Fork me on GitHub" corner ribbon, carried over from the legacy site.
 *
 * Built from theme tokens rather than pulling in `github-fork-ribbon-css` (the
 * package the Angular app loaded globally): that stylesheet hardcodes its own
 * colours, which would ignore the light/dark schemes and the theme presets.
 *
 * Hidden below `md` — a fixed corner ribbon overlaps content on phones, and the
 * footer already carries a GitHub link.
 */
export default function ForkRibbon() {
  const { repo_url: repoUrl } = useBranding();

  if (!repoUrl) return null;

  return (
    <Box
      component="a"
      href={repoUrl}
      target="_blank"
      rel="noopener"
      aria-label="Fork this project on GitHub"
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'fixed',
        top: 0,
        right: 0,
        // The ribbon is a square rotated 45° and clipped to the corner, so the
        // band runs diagonally across it.
        width: 150,
        height: 150,
        overflow: 'hidden',
        // Above the sticky AppBar, below MUI modals (1300).
        zIndex: 1200,
        textDecoration: 'none',
        pointerEvents: 'none',

        '& span': {
          pointerEvents: 'auto',
          position: 'absolute',
          // Sized so the band's centre lands on the corner's 45° bisector:
          // with width 200 and right -46 the centre sits at x=96, and 150-96=54
          // is the matching y once half the band's height (~17) is subtracted.
          top: 37,
          right: -46,
          width: 200,
          transform: 'rotate(45deg)',
          textAlign: 'center',
          py: 0.75,
          fontSize: '0.8125rem',
          lineHeight: 1.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          // The dotted inset rules are the visual signature of the original
          // github-fork-ribbon-css band; without them it reads as a plain bar.
          // Derived from the text colour rather than hardcoded white: the dark
          // presets use a near-black contrastText, where white would be wrong.
          borderTop: '1px dotted',
          borderBottom: '1px dotted',
          borderColor: 'color-mix(in srgb, currentColor 55%, transparent)',
          boxShadow: 3,
          transition: 'filter 0.2s',
        },
        '&:hover span': { filter: 'brightness(1.1)' },
        '&:focus-visible span': { outline: '2px solid', outlineOffset: 2 },

        '@media (prefers-reduced-motion: reduce)': {
          '& span': { transition: 'none' },
        },
      }}
    >
      <span>Fork me on GitHub</span>
    </Box>
  );
}
