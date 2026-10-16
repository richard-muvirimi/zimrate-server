import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import EChart from './EChart';
import { axis, baseOption, compact, escapeHtml, percent, useChartTheme } from './chartTheme';
import type { FreshnessBucket, Move, QuoteRow, SourceState } from './rateStats';

const formatRate = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Swatch + label pairs under a chart; identity never rides on colour alone. */
export function ChartKey({ items }: { items: { color: string; label: string }[] }) {
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ px: 1, pt: 0.5 }}>
      {items.map(({ color, label }) => (
        <Stack key={label} direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function FreshnessChart({ buckets }: { buckets: FreshnessBucket[] }) {
  const t = useChartTheme();

  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { left: 4, right: 8, top: 28, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: buckets.map((b) => b.label), ...axis(t), splitLine: { show: false } },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...axis(t),
        axisLine: { show: false },
        axisLabel: { ...axis(t).axisLabel, formatter: compact },
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.35 } },
        formatter: (params: { name: string; value: number }[]) =>
          `${escapeHtml(params[0].name)} ago<br/><b>${params[0].value.toLocaleString()}</b> rates`,
      },
      series: [{
        type: 'bar',
        barMaxWidth: 24,
        data: buckets.map((b) => ({
          value: b.count,
          itemStyle: { color: b.lagging ? t.neutral : t.accent, borderRadius: [4, 4, 0, 0] },
        })),
        label: { show: true, position: 'top', color: t.text, fontWeight: 600, fontFamily: t.font },
      }],
    };
  }, [buckets, t]);

  return (
    <>
      <EChart option={option} height={220} />
      <ChartKey
        items={[
          { color: t.accent, label: 'Checked in the last 6 hours' },
          { color: t.neutral, label: 'Older, but still shown' },
        ]}
      />
    </>
  );
}

const SOURCE_STATES: { state: SourceState; label: string }[] = [
  { state: 'working', label: 'Working' },
  { state: 'probation', label: 'On probation' },
  { state: 'failing', label: 'Failing' },
  { state: 'unchecked', label: 'Not checked yet' },
  { state: 'off', label: 'Switched off' },
];

export function SourceHealthChart({ counts }: { counts: Record<SourceState, number> }) {
  const t = useChartTheme();
  const colors: Record<SourceState, string> = useMemo(() => ({
    working: t.good,
    probation: t.warning,
    failing: t.critical,
    unchecked: t.muted,
    off: t.neutral,
  }), [t]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const option = useMemo(() => {
    const shown = SOURCE_STATES.filter(({ state }) => counts[state] > 0);
    const base = baseOption(t);
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${escapeHtml(p.name)}<br/><b>${p.value}</b> sources · ${Math.round(p.percent)}%`,
      },
      series: [{
        type: 'pie',
        radius: ['66%', '92%'],
        padAngle: 2,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderRadius: 4 },
        emphasis: { scale: true, scaleSize: 4 },
        data: shown.map(({ state, label }) => ({
          name: label,
          value: counts[state],
          itemStyle: { color: colors[state] },
        })),
      }],
    };
  }, [counts, colors, t]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={3} sx={{ px: 1, py: 1 }}>
      <Box sx={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
        <EChart option={option} height={180} />
        <Box
          sx={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            pointerEvents: 'none', textAlign: 'center',
          }}
        >
          <Box>
            <Typography variant="h4" component="p" fontWeight={700} lineHeight={1}>{total}</Typography>
            <Typography variant="caption" color="text.secondary">sources</Typography>
          </Box>
        </Box>
      </Box>
      <Stack spacing={1.25} sx={{ flexGrow: 1, width: '100%' }}>
        {SOURCE_STATES.map(({ state, label }) => (
          <Stack key={state} direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: colors[state], flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flexGrow: 1 }}>{label}</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {counts[state]}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export function QuoteSpreadChart({ rows }: { rows: QuoteRow[] }) {
  const t = useChartTheme();
  // Category axes run bottom-up; reversed so the most-quoted currency sits on top.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);

  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { left: 4, right: 16, top: 24, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        ...axis(t),
        axisLabel: { ...axis(t).axisLabel, formatter: (v: number) => percent(v, 0) },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((r) => r.currency),
        ...axis(t),
        splitLine: { show: false },
        axisLine: { show: false },
        axisLabel: {
          ...axis(t).axisLabel,
          formatter: (code: string) => {
            const row = ordered.find((r) => r.currency === code)!;
            return `{code|${code}}\n{count|${row.count} quotes}`;
          },
          rich: {
            code: { color: t.text, fontWeight: 700, fontSize: 12, fontFamily: t.font },
            count: { color: t.muted, fontSize: 10, fontFamily: t.font, padding: [2, 0, 0, 0] },
          },
        },
      },
      tooltip: { ...base.tooltip, trigger: 'item' },
      series: [
        {
          // The span from lowest to highest quote, drawn under the dots.
          type: 'custom',
          silent: true,
          renderItem: (_: unknown, api: {
            value: (i: number) => number;
            coord: (v: number[]) => number[];
          }) => {
            const start = api.coord([api.value(1), api.value(0)]);
            const end = api.coord([api.value(2), api.value(0)]);
            return {
              type: 'line',
              shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] },
              style: { stroke: t.grid, lineWidth: 8, lineCap: 'round' },
            };
          },
          encode: { x: [1, 2], y: 0 },
          data: ordered.map((r, i) => [i, r.min, r.max]),
          z: 1,
        },
        {
          type: 'scatter',
          z: 2,
          data: ordered.flatMap((r, i) => r.points.map((p) => ({
            value: [p.offset, i],
            symbolSize: 10 + Math.min(p.names.length - 1, 4) * 2,
            row: r,
            point: p,
          }))),
          itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
          tooltip: {
            formatter: ({ data }: { data: { row: QuoteRow; point: QuoteRow['points'][number] } }) => {
              const { row, point } = data;
              const names = point.names.slice(0, 5).map(escapeHtml).join('<br/>');
              const more = point.names.length > 5 ? `<br/>and ${point.names.length - 5} more` : '';
              return `<b>${formatRate(point.rate)} ${row.currency}</b> per US dollar<br/>`
                + `${percent(point.offset)} vs the typical ${formatRate(row.median)}<br/>`
                + `<span style="opacity:.75">${names}${more}</span>`;
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: t.muted, type: 'solid', width: 1 },
            label: { formatter: 'Typical', color: t.muted, fontFamily: t.font, fontSize: 11 },
            data: [{ xAxis: 0 }],
          },
        },
      ],
    };
  }, [ordered, t]);

  return <EChart option={option} height={rows.length * 44 + 36} />;
}

export function RateMovesChart({ moves }: { moves: Move[] }) {
  const t = useChartTheme();
  const ordered = useMemo(() => [...moves].reverse(), [moves]);

  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { left: 4, right: 48, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        // Room left of the falling bars for their labels, which would
        // otherwise run into the rate names on the axis.
        boundaryGap: [ordered.some((m) => m.change < 0) ? '30%' : 0, 0],
        ...axis(t),
        axisLabel: { ...axis(t).axisLabel, formatter: (v: number) => `${v}%` },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((m) => `${m.currency} · ${m.name}`),
        ...axis(t),
        splitLine: { show: false },
        axisLabel: { ...axis(t).axisLabel, width: 150, overflow: 'truncate' },
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: ({ dataIndex }: { dataIndex: number }) => {
          const m = ordered[dataIndex];
          return `<b>${escapeHtml(m.currency)}</b> · ${escapeHtml(m.name)}<br/>`
            + `${formatRate(m.from)} → <b>${formatRate(m.to)}</b> (${percent(m.change)})`;
        },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 16,
        data: ordered.map((m) => ({
          value: +(m.change * 100).toFixed(2),
          itemStyle: {
            color: m.change > 0 ? t.accent : t.contrast,
            borderRadius: m.change > 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
          label: { position: m.change > 0 ? 'right' : 'left' },
        })),
        label: {
          show: true,
          color: t.text,
          fontFamily: t.font,
          fontSize: 11,
          fontWeight: 600,
          formatter: ({ value }: { value: number }) => percent(value / 100),
        },
      }],
    };
  }, [ordered, t]);

  return (
    <>
      <EChart option={option} height={moves.length * 34 + 36} />
      <ChartKey
        items={[
          { color: t.accent, label: 'Rose: a US dollar costs more' },
          { color: t.contrast, label: 'Fell: a US dollar costs less' },
        ]}
      />
    </>
  );
}
