import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OwnedBookService } from '../owned-books/services/owned-book.service';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';
import { CHART } from '../shared/charts/chart';

@Component({
  selector: 'app-stats',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class Stats implements OnInit {
  private readonly service = inject(OwnedBookService);
  private readonly Chart = inject(CHART);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('genderChart');
  private readonly readingCanvas = viewChild<ElementRef<HTMLCanvasElement>>('readingChart');
  private readonly genreCanvas = viewChild<ElementRef<HTMLCanvasElement>>('genreChart');
  private readonly books = signal<LibraryBookSummary[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly libraryTotal = computed(() => this.books().length);
  protected readonly genres = computed(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const book of this.books()) {
      const seen = new Set<string>();
      for (const genre of book.genres ?? []) {
        const label = genre.trim();
        const key = label.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const group = counts.get(key);
        if (group) group.count++;
        else counts.set(key, { label, count: 1 });
      }
    }
    const colors = ['#254d3c', '#bf4d38', '#77639c', '#ba8732', '#48838c', '#a55e7d', '#718253'];
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map((group, index) => ({ ...group, color: colors[index % colors.length] }));
  });
  protected readonly readingStatuses = computed(() => {
    const dnf = this.books().filter((book) => book.isDnf).length;
    const read = this.books().filter((book) => book.isRead && !book.isDnf).length;
    const total = this.libraryTotal();
    return [
      { label: 'Read', value: 'read', color: '#254d3c', count: read },
      { label: 'Unread', value: 'unread', color: '#bf4d38', count: total - read - dnf },
      { label: 'Did not finish', value: 'dnf', color: '#ba8732', count: dnf },
    ].map((group) => ({
      ...group,
      percentage: total ? (group.count / total) * 100 : 0,
    }));
  });
  protected readonly total = computed(() =>
    this.genders().reduce((sum, group) => sum + group.count, 0),
  );
  protected readonly genders = computed(() => {
    const groups = [
      { label: 'Man', value: 'male', color: '#254d3c', count: 0 },
      { label: 'Woman', value: 'female', color: '#bf4d38', count: 0 },
      { label: 'Unknown', value: 'unknown', color: '#918779', count: 0 },
      { label: 'Non-Binary', value: 'non-binary', color: '#77639c', count: 0 },
    ];
    for (const book of this.books()) {
      const value = book.authorGender?.trim().toLowerCase();
      const group = groups.find((group) => group.value === value);
      if (group) group.count++;
    }
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    return groups.map((group) => ({
      ...group,
      percentage: total ? (group.count / total) * 100 : 0,
    }));
  });

  constructor() {
    effect((onCleanup) => {
      const canvas = this.genreCanvas()?.nativeElement;
      if (!canvas) return;
      const groups = this.genres();
      const chart = new this.Chart(canvas, {
        type: 'bar',
        data: {
          labels: groups.map((group) => group.label),
          datasets: [
            {
              label: 'Books',
              data: groups.map((group) => group.count),
              backgroundColor: groups.map((group) => group.color),
              borderRadius: 4,
              maxBarThickness: 64,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              title: { display: true, text: 'Number of books' },
              ticks: { precision: 0 },
            },
            y: {
              title: { display: true, text: 'Genre' },
              grid: { display: false },
              ticks: { autoSkip: false },
            },
          },
        },
      });
      onCleanup(() => chart.destroy());
    });
    for (const { canvas: chartCanvas, groups: chartGroups } of [
      { canvas: this.canvas, groups: this.genders },
      { canvas: this.readingCanvas, groups: this.readingStatuses },
    ]) {
      effect((onCleanup) => {
        const canvas = chartCanvas()?.nativeElement;
        if (!canvas) return;
        const groups = chartGroups();
        const chart = new this.Chart(canvas, {
          type: 'pie',
          data: {
            labels: groups.map((group) => group.label),
            datasets: [
              {
                label: 'Books',
                data: groups.map((group) => group.count),
                backgroundColor: groups.map((group) => group.color),
                borderColor: '#fffdf8',
                borderWidth: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
          },
        });
        onCleanup(() => chart.destroy());
      });
    }
  }

  ngOnInit() {
    this.loadBooks();
  }

  protected loadBooks() {
    this.state.set('loading');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (books) => {
          this.books.set(books);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
