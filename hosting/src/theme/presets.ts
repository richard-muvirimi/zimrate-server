/**
 * Theme presets.
 *
 * Every scheme is typed through the explicit `PresetScheme` interface below
 * rather than MUI's `PaletteOptions`. That matters: `code` is required on
 * `Palette` but OPTIONAL on `PaletteOptions`, so a preset missing `code.*`
 * would compile cleanly and then crash at runtime the first time something
 * renders `bgcolor: 'code.bg'` (ErrorBoundary does exactly that).
 */

export type PresetId = 'zimrate' | 'slate' | 'emerald' | 'violet';

export const DEFAULT_PRESET: PresetId = 'zimrate';

export interface PresetScheme {
  mode: 'light' | 'dark';
  background: { default: string; paper: string; subtle: string; elevated: string };
  divider: string;
  primary: { main: string; light: string; dark: string; contrastText: string };
  secondary: { main: string; dark: string; contrastText: string };
  success: { main: string };
  warning: { main: string };
  error: { main: string };
  text: { primary: string; secondary: string; disabled: string };
  code: { bg: string; text: string; keyword: string; string: string; flag: string };
  /** Gradient for contained primary buttons; kept per-scheme so it can differ. */
  gradient: string;
}

export interface Preset {
  id: PresetId;
  label: string;
  /** Swatch shown in the picker. */
  swatch: string;
  dark: PresetScheme;
  light: PresetScheme;
}

/** Shared neutrals — presets differ by accent, not by surface structure. */
const darkNeutrals = {
  background: { default: '#0B1017', paper: '#121926', subtle: '#0F1520', elevated: '#1B2534' },
  divider: '#223047',
  success: { main: '#3DD68C' },
  warning: { main: '#FFB86B' },
  error: { main: '#FF6B6B' },
  text: { primary: '#E8EEF7', secondary: '#8FA3BF', disabled: '#4A5A72' },
} as const;

const lightNeutrals = {
  background: { default: '#F5F8FC', paper: '#FFFFFF', subtle: '#EDF3FA', elevated: '#E4EDF7' },
  divider: '#D3E0EF',
  success: { main: '#1A7F4B' },
  warning: { main: '#B45309' },
  error: { main: '#C0392B' },
  text: { primary: '#0C1826', secondary: '#55677E', disabled: '#9AAABF' },
} as const;

interface Accent {
  darkPrimary: PresetScheme['primary'];
  darkSecondary: PresetScheme['secondary'];
  darkGradient: string;
  darkKeyword: string;
  lightPrimary: PresetScheme['primary'];
  lightSecondary: PresetScheme['secondary'];
  lightGradient: string;
  lightKeyword: string;
}

function build(id: PresetId, label: string, swatch: string, a: Accent): Preset {
  return {
    id,
    label,
    swatch,
    dark: {
      mode: 'dark',
      ...darkNeutrals,
      primary: a.darkPrimary,
      secondary: a.darkSecondary,
      gradient: a.darkGradient,
      code: {
        bg: '#060B12',
        text: '#C7D5E8',
        keyword: a.darkKeyword,
        string: '#6EE7A8',
        flag: '#FFB86B',
      },
    },
    light: {
      mode: 'light',
      ...lightNeutrals,
      primary: a.lightPrimary,
      secondary: a.lightSecondary,
      gradient: a.lightGradient,
      code: {
        bg: '#F0F4FA',
        text: '#2B3A4E',
        keyword: a.lightKeyword,
        string: '#1A7F4B',
        flag: '#B45309',
      },
    },
  };
}

export const PRESETS: Record<PresetId, Preset> = {
  // The original palette — unchanged, so anyone who never picks a preset sees
  // exactly what they see today.
  zimrate: build('zimrate', 'ZimRate Blue', '#2E9BFF', {
    darkPrimary: { main: '#2E9BFF', light: '#5FB4FF', dark: '#0A6FD1', contrastText: '#04101E' },
    darkSecondary: { main: '#00C8E0', dark: '#0097AD', contrastText: '#04101E' },
    darkGradient: 'linear-gradient(65deg, #0A6FD1 0%, #2E9BFF 100%)',
    darkKeyword: '#5FB4FF',
    lightPrimary: { main: '#0B6FD0', light: '#2E9BFF', dark: '#075293', contrastText: '#FFFFFF' },
    lightSecondary: { main: '#0097AD', dark: '#00707F', contrastText: '#FFFFFF' },
    lightGradient: 'linear-gradient(65deg, #075293 0%, #0B6FD0 100%)',
    lightKeyword: '#0B6FD0',
  }),
  slate: build('slate', 'Slate', '#7C8CA1', {
    darkPrimary: { main: '#8CA0B8', light: '#AEBECF', dark: '#5E7086', contrastText: '#0B1017' },
    darkSecondary: { main: '#9BB3C7', dark: '#6C8296', contrastText: '#0B1017' },
    darkGradient: 'linear-gradient(65deg, #5E7086 0%, #8CA0B8 100%)',
    darkKeyword: '#AEBECF',
    lightPrimary: { main: '#4A5C72', light: '#7C8CA1', dark: '#33435A', contrastText: '#FFFFFF' },
    lightSecondary: { main: '#5E7086', dark: '#41525F', contrastText: '#FFFFFF' },
    lightGradient: 'linear-gradient(65deg, #33435A 0%, #4A5C72 100%)',
    lightKeyword: '#4A5C72',
  }),
  emerald: build('emerald', 'Emerald', '#10B981', {
    darkPrimary: { main: '#34D399', light: '#6EE7B7', dark: '#0F9C6D', contrastText: '#04140E' },
    darkSecondary: { main: '#2DD4BF', dark: '#0E9384', contrastText: '#04140E' },
    darkGradient: 'linear-gradient(65deg, #0F9C6D 0%, #34D399 100%)',
    darkKeyword: '#6EE7B7',
    lightPrimary: { main: '#0F9C6D', light: '#34D399', dark: '#0A6E4C', contrastText: '#FFFFFF' },
    lightSecondary: { main: '#0E9384', dark: '#0A6C61', contrastText: '#FFFFFF' },
    lightGradient: 'linear-gradient(65deg, #0A6E4C 0%, #0F9C6D 100%)',
    lightKeyword: '#0F9C6D',
  }),
  violet: build('violet', 'Violet', '#8B5CF6', {
    darkPrimary: { main: '#A78BFA', light: '#C4B5FD', dark: '#7C4DE0', contrastText: '#0B0518' },
    darkSecondary: { main: '#F0ABFC', dark: '#C026D3', contrastText: '#0B0518' },
    darkGradient: 'linear-gradient(65deg, #7C4DE0 0%, #A78BFA 100%)',
    darkKeyword: '#C4B5FD',
    lightPrimary: { main: '#6D3BD1', light: '#8B5CF6', dark: '#4C2794', contrastText: '#FFFFFF' },
    lightSecondary: { main: '#A21CAF', dark: '#701A75', contrastText: '#FFFFFF' },
    lightGradient: 'linear-gradient(65deg, #4C2794 0%, #6D3BD1 100%)',
    lightKeyword: '#6D3BD1',
  }),
};

export const PRESET_LIST: Preset[] = Object.values(PRESETS);

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && value in PRESETS;
}
