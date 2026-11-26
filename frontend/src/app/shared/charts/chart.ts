// Register Chart.js chart types, scales, and plugins when a chart consumer loads.
// Import here from lazy-loaded pages to keep charts out of the initial bundle.
import { InjectionToken } from '@angular/core';
import Chart from 'chart.js/auto';

export { Chart };
export type { ChartConfiguration, ChartData, ChartOptions, ChartType } from 'chart.js';

export const CHART = new InjectionToken<typeof Chart>('Chart.js', {
  providedIn: 'root',
  factory: () => Chart,
});
