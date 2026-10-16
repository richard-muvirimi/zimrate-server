import { useMemo } from 'react';
import EChart from './EChart';
import { axis, baseOption, compact, escapeHtml, useChartTheme } from './chartTheme';
import { ChartKey } from './RateCharts';

interface FlowProps {
  earned: number;
  bought: number;
  spent: number;
}

/** Coins added (free and bought, stacked) against coins spent, over one window. */
export function CoinFlowChart({ earned, bought, spent }: FlowProps) {
  const t = useChartTheme();

  const option = useMemo(() => {
    const base = baseOption(t);
    // A 1px surface-coloured edge on each segment makes a 2px gap where two meet.
    const segment = (color: string, radius: number[]) => ({
      color, borderColor: t.surface, borderWidth: 1, borderRadius: radius,
    });
    return {
      ...base,
      grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        ...axis(t),
        axisLabel: { ...axis(t).axisLabel, formatter: compact },
      },
      yAxis: {
        type: 'category',
        data: ['Spent', 'Added'],
        ...axis(t),
        splitLine: { show: false },
        axisLabel: { ...axis(t).axisLabel, color: t.text, fontWeight: 600 },
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.35 } },
        formatter: (params: { seriesName: string; value: number | null; marker: string }[]) =>
          params
            .filter((p) => p.value)
            .map((p) => `${p.marker}${escapeHtml(p.seriesName)}: <b>${p.value!.toLocaleString()}</b>`)
            .join('<br/>'),
      },
      series: [
        {
          name: 'Earned free',
          type: 'bar',
          stack: 'flow',
          barMaxWidth: 24,
          data: [null, earned],
          itemStyle: segment(t.accent, bought ? [0, 0, 0, 0] : [0, 4, 4, 0]),
        },
        {
          name: 'Bought',
          type: 'bar',
          stack: 'flow',
          barMaxWidth: 24,
          data: [null, bought],
          itemStyle: segment(t.contrast, [0, 4, 4, 0]),
        },
        {
          name: 'Spent',
          type: 'bar',
          stack: 'flow',
          barMaxWidth: 24,
          data: [spent, null],
          itemStyle: segment(t.neutral, [0, 4, 4, 0]),
        },
      ],
    };
  }, [earned, bought, spent, t]);

  return (
    <>
      <EChart option={option} height={130} />
      <ChartKey
        items={[
          { color: t.accent, label: `Earned free: ${earned.toLocaleString()}` },
          { color: t.contrast, label: `Bought: ${bought.toLocaleString()}` },
          { color: t.neutral, label: `Spent: ${spent.toLocaleString()}` },
        ]}
      />
    </>
  );
}

export interface GrantType {
  label: string;
  count: number;
  coins: number;
}

/** Coins handed out per grant type, largest first. */
export function GrantTypesChart({ types }: { types: GrantType[] }) {
  const t = useChartTheme();
  const ordered = useMemo(() => [...types].reverse(), [types]);

  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { left: 4, right: 56, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        ...axis(t),
        axisLabel: { ...axis(t).axisLabel, formatter: compact },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((g) => g.label),
        ...axis(t),
        splitLine: { show: false },
        axisLabel: { ...axis(t).axisLabel, width: 140, overflow: 'truncate' },
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: ({ dataIndex }: { dataIndex: number }) => {
          const g = ordered[dataIndex];
          return `${escapeHtml(g.label)}<br/><b>${g.coins.toLocaleString()}</b> coins from ${g.count.toLocaleString()} grants`;
        },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 16,
        data: ordered.map((g) => g.coins),
        itemStyle: { color: t.accent, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: t.text,
          fontFamily: t.font,
          fontSize: 11,
          fontWeight: 600,
          formatter: ({ value }: { value: number }) => compact(value),
        },
      }],
    };
  }, [ordered, t]);

  return <EChart option={option} height={types.length * 34 + 36} />;
}
