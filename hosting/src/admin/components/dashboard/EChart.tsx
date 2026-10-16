import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BarChart, CustomChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

// Registered piecemeal rather than `import * from 'echarts'`: the full build is
// close to a megabyte, and the dashboard needs four chart types.
echarts.use([
  BarChart, CustomChart, PieChart, ScatterChart,
  AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent,
  SVGRenderer,
]);

interface Props {
  option: EChartsCoreOption;
  height: number;
}

/**
 * Thin ECharts host. The instance lives for the component's lifetime and only
 * its option changes, so a theme flip or a data refresh repaints in place
 * instead of tearing the chart down.
 */
export default function EChart({ option, height }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const instance = echarts.init(ref.current!, null, { renderer: 'svg' });
    chart.current = instance;
    // The card resizes with the drawer and the grid breakpoints, not only the window.
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <Box ref={ref} sx={{ width: '100%', height }} />;
}
