import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { DEFAULT_PRESET, PRESETS, type PresetId, type PresetScheme } from './presets';

declare module '@mui/material/styles' {
  interface TypeBackground {
    /** Alternating section band. Distinct from `paper` so it can diverge in light mode. */
    subtle: string;
    /** Raised surfaces inside a card: table heads, inset panels. */
    elevated: string;
  }

  interface CodePalette {
    bg: string;
    text: string;
    keyword: string;
    string: string;
    flag: string;
  }

  interface Palette {
    code: CodePalette;
  }

  interface PaletteOptions {
    code?: CodePalette;
  }
}

/** Strip the gradient — it is not a colour, so it must not enter the palette. */
function paletteOf(scheme: PresetScheme) {
  const palette: Omit<PresetScheme, 'gradient'> & { gradient?: string } = { ...scheme };
  delete palette.gradient;
  return palette;
}

const cache = new Map<PresetId, Theme>();

/**
 * Builds the MUI theme for a preset.
 *
 * Cached because a new theme object identity re-renders the whole tree and
 * regenerates every CSS variable — fine once per preset change, expensive per
 * render.
 */
export function buildTheme(id: PresetId = DEFAULT_PRESET): Theme {
  const hit = cache.get(id);
  if (hit) return hit;

  const preset = PRESETS[id] ?? PRESETS[DEFAULT_PRESET];

  const theme = createTheme({
    cssVariables: {
      // Hard-coded in the FOUC script in index.html — keep in sync.
      // The storage keys are ThemeProvider props, not theme options; see main.tsx.
      colorSchemeSelector: 'data-mui-color-scheme',
    },
    defaultColorScheme: 'dark',
    colorSchemes: {
      dark: { palette: paletteOf(preset.dark) },
      light: { palette: paletteOf(preset.light) },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, letterSpacing: '-0.01em' },
      h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        // CssBaseline has no ownerState, so the callback receives the theme itself.
        styleOverrides: (theme) => ({
          html: {
            // scrollIntoView honours scroll-padding-top, which keeps hash targets
            // clear of the sticky AppBar without any offset maths in JS.
            scrollBehavior: 'smooth',
            scrollPaddingTop: 80,
            '@media (prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' },
          },
          body: {
            backgroundColor: theme.vars.palette.background.default,
            // Makes native controls and default scrollbars follow the scheme.
            colorScheme: theme.palette.mode,
            scrollbarColor: `${theme.vars.palette.divider} ${theme.vars.palette.background.default}`,
            '&::-webkit-scrollbar': { width: 8 },
            '&::-webkit-scrollbar-track': { background: theme.vars.palette.background.default },
            '&::-webkit-scrollbar-thumb': {
              background: theme.vars.palette.divider,
              borderRadius: 4,
            },
          },
        }),
      },
      MuiPaper: {
        styleOverrides: {
          // No explicit backgroundColor: Paper backs Card, Menu, Dialog, Drawer,
          // Accordion and TableContainer, so letting it resolve background.paper
          // is what makes those all work in both schemes.
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: theme.vars.palette.divider,
          }),
        },
      },
      MuiAppBar: {
        // Without this the bar keeps MUI's primary-coloured contrast text, which
        // renders the nav links white-on-white in the light scheme.
        defaultProps: { color: 'default' },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            backgroundColor: theme.vars.palette.background.default,
            color: theme.vars.palette.text.primary,
            borderBottom: '1px solid',
            borderColor: theme.vars.palette.divider,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          // Closed over the preset rather than read from the palette: MUI's CSS
          // variable generator treats palette entries as colours and cannot
          // parse a linear-gradient(). Cost is that it does not flip between
          // light and dark, which matches the previous behaviour.
          containedPrimary: {
            background: preset.dark.gradient,
            '&:hover': { background: preset.dark.gradient, filter: 'brightness(1.08)' },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.vars.palette.divider }),
          head: ({ theme }) => ({
            backgroundColor: theme.vars.palette.background.elevated,
            fontWeight: 700,
          }),
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.vars.palette.divider }),
        },
      },
    },
  });

  cache.set(id, theme);
  return theme;
}

export default buildTheme;
