# My Library frontend

See the [root README](../README.md) for prerequisites, API startup, proxy configuration,
and verification instructions.

From this directory:

```sh
npm ci
npm start
```

Open http://localhost:4200 with the API running on http://localhost:5080.

```sh
npm run build
npm test -- --watch=false
```

## Charts

Chart.js is installed with its built-in TypeScript types. Import the configured
constructor from `src/app/shared/charts/chart.ts` in chart components:

```ts
import { Chart, type ChartConfiguration } from './shared/charts/chart';

const config: ChartConfiguration<'bar'> = {
  type: 'bar',
  data: {
    labels: ['Read', 'Unread'],
    datasets: [{ label: 'Books', data: [12, 8] }],
  },
  options: { responsive: true, maintainAspectRatio: false },
};

const chart = new Chart(canvas, config);
```

Adjust the relative import for the component's location. `canvas` must be an
`HTMLCanvasElement` obtained from the component view after it renders (for example,
in `ngAfterViewInit`). Give its parent a height and `position: relative`, and give
the canvas an accessible label and a text or table alternative for its data.
Update `chart.data` and call `chart.update()` when data changes. Call
`chart.destroy()` when the component is destroyed, before reusing its canvas.

The shared entry uses `chart.js/auto` to register all built-in chart types, scales,
and plugins. Import it from lazy-loaded chart pages so it loads with those pages.
No global scripts, Angular providers, or separate type package are required.
The Stats page at `/stats` shows a pie chart of books by recorded author gender:
Man, Woman, Unknown, and Non-Binary. Each owned book with one of these recorded
values counts once. Unknown is an explicit dropdown choice. Blank values and
legacy `other` values are excluded from counts and percentages; gender is never
inferred from names.

A second pie chart shows Read and Unread counts and percentages across all books,
including books without a recorded author gender.

See the [Chart.js integration guide](https://www.chartjs.org/docs/latest/getting-started/integration.html).
