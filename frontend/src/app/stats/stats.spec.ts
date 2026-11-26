import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { CHART, type ChartConfiguration } from '../shared/charts/chart';
import { Stats } from './stats';

const chartMock = vi.fn(
  class {
    constructor(_canvas: HTMLCanvasElement, _config: ChartConfiguration) {}
    destroy = vi.fn();
  },
);

describe('Stats', () => {
  let fixture: ComponentFixture<Stats>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Stats],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CHART, useValue: chartMock },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('counts explicit choices, excludes blank values from counts and percentages, and cleans up', async () => {
    http
      .expectOne('/api/library/books')
      .flush([
        { author: 'Same Author', authorGender: 'male' },
        { author: 'Same Author', authorGender: 'male' },
        { authorGender: 'female' },
        { authorGender: 'non-binary' },
        { authorGender: 'unknown' },
        { authorGender: null },
        { authorGender: '' },
        { authorGender: '   ' },
        { authorGender: 'other' },
        {},
      ]);
    await fixture.whenStable();
    const chart = chartMock;
    expect(chart).toHaveBeenCalledTimes(2);
    const config = chart.mock.calls.find(([, config]) => config.data.labels?.includes('Man'))![1];
    expect(config).toMatchObject({ type: 'pie' });
    expect(config.data.labels).toEqual(['Man', 'Woman', 'Unknown', 'Non-Binary']);
    expect(config.data.datasets[0].data).toEqual([2, 1, 1, 1]);
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('#gender-table tbody tr') as NodeListOf<HTMLElement>,
    );
    expect(rows.map((row) => row.querySelector('td')?.textContent?.trim())).toEqual([
      '2',
      '1',
      '1',
      '1',
    ]);
    expect(rows[2].textContent).toContain('20%');
    expect(fixture.nativeElement.querySelector('#gender-table caption').textContent).toContain('5');
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="Pie chart of books by author gender"]')
        .getAttribute('aria-describedby'),
    ).toContain('gender-table');
    const instances = chart.mock.results.map((result) => result.value);
    fixture.destroy();
    for (const instance of instances) expect(instance.destroy).toHaveBeenCalledOnce();
  });

  it('shows reading status but no gender chart when all gender values are blank', async () => {
    http
      .expectOne('/api/library/books')
      .flush([{ authorGender: null }, { authorGender: '' }, { authorGender: '   ' }, {}]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No author genders have been recorded');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Pie chart of books by author gender"]'),
    ).toBeNull();
    expect(chartMock).toHaveBeenCalledOnce();
    expect(chartMock.mock.calls[0][1].data.labels).toEqual(['Read', 'Unread']);
  });

  it('shows an empty state without creating a chart', async () => {
    http.expectOne('/api/library/books').flush([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Add your first book');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    expect(chartMock).not.toHaveBeenCalled();
  });

  it('shows a loading state and allows retrying a failed request', async () => {
    expect(fixture.nativeElement.textContent).toContain('Loading your stats');
    http.expectOne('/api/library/books').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(chartMock).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button').click();
    http.expectOne('/api/library/books').flush([{ authorGender: 'non-binary' }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(chartMock).toHaveBeenCalledTimes(2);
  });

  for (const statuses of [
    [true, false, false, false],
    [true, true],
    [false, false],
  ]) {
    it(`charts reading statuses ${statuses.join(', ')} across the full library`, async () => {
      http
        .expectOne('/api/library/books')
        .flush(statuses.map((isRead) => ({ isRead, authorGender: null })));
      await fixture.whenStable();
      expect(chartMock).toHaveBeenCalledOnce();
      const config = chartMock.mock.calls[0][1];
      expect(config).toMatchObject({ type: 'pie' });
      expect(config.data.labels).toEqual(['Read', 'Unread']);
      const read = statuses.filter(Boolean).length;
      expect(config.data.datasets[0].data).toEqual([read, statuses.length - read]);
      const rows = Array.from(
        fixture.nativeElement.querySelectorAll(
          '#reading-table tbody tr',
        ) as NodeListOf<HTMLElement>,
      );
      expect(rows[0].textContent).toContain(`${(read / statuses.length) * 100}%`);
      expect(rows[1].textContent).toContain(
        `${((statuses.length - read) / statuses.length) * 100}%`,
      );
      expect(fixture.nativeElement.querySelector('#reading-table caption').textContent).toContain(
        String(statuses.length),
      );
    });
  }
});
