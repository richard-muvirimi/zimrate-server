import { useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { useColorScheme, useTheme } from '@mui/material/styles';
import type { CssVarsTheme } from '@mui/material/styles';
import { format } from 'echarts/core';

export interface ChartTheme {
  font: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
  /** The preset's primary: single-series marks follow the brand. */
  accent: string;
  /** Opposite pole to the accent, for values below zero. */
  contrast: string;
  good: string;
  warning: string;
  critical: string;
  /** Marks that mean "nothing to report": switched off, not yet checked. */
  neutral: string;
  animate: boolean;
}

/**
 * Resolved colours for ECharts, which paints to SVG attributes and cannot read
 * the CSS variables the rest of the theme is expressed in. Read from the
 * active colour scheme rather than `theme.palette`, which with CSS variables
 * on is always the default (dark) scheme.
 */
export function useChartTheme(): ChartTheme {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const scheme = colorScheme ?? 'dark';
  // buildTheme turns CSS variables on, but the Theme type only says so under a
  // module augmentation this project does not make.
  const palette = (theme as unknown as CssVarsTheme).colorSchemes[scheme]?.palette ?? theme.palette;

  return useMemo(() => ({
    font: theme.typography.fontFamily ?? 'sans-serif',
    text: palette.text.primary,
    muted: palette.text.secondary,
    grid: palette.divider,
    surface: palette.background.paper,
    accent: palette.primary.main,
    contrast: scheme === 'dark' ? '#d95926' : '#eb6834',
    good: palette.success.main,
    warning: palette.warning.main,
    critical: palette.error.main,
    neutral: palette.text.disabled,
    animate: !reduceMotion,
  }), [palette, scheme, reduceMotion, theme.typography.fontFamily]);
}

/** Option keys every dashboard chart shares: type, motion, tooltip chrome. */
export function baseOption(t: ChartTheme) {
  return {
    animation: t.animate,
    aria: { enabled: true },
    textStyle: { fontFamily: t.font, color: t.muted },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.grid,
      padding: [8, 12],
      textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
      extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,0.18);border-radius:8px;',
    },
  };
}

/** Recessive axis: hairline grid, no ticks, secondary-ink labels. */
export function axis(t: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontFamily: t.font, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, type: 'solid' as const } },
  };
}

/** Escapes text that came from a scraped page before it goes into a tooltip's HTML. */
export const escapeHtml = format.encodeHTML;

/** 1,284 / 12.9K / 4.2M — for axis ticks, where room is short. */
export const compact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const percent = (value: number, digits = 1) =>
  `${value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
