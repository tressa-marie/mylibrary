import { goalProgress } from './goal-progress';
import { Goal } from './goal.service';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';

const goal = (goalType: Goal['goalType'], num = 100): Goal => ({
  id: 'test',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  goalType,
  num,
  includeNonLibraryBooks: false,
});
const book = (fields: Partial<LibraryBookSummary> = {}): LibraryBookSummary => ({
  id: 'test',
  title: 'Test',
  author: '',
  genres: [],
  isRead: false,
  rating: null,
  shelfId: null,
  shelfLocation: null,
  authorGender: null,
  pageCount: null,
  ...fields,
});

describe('goal progress', () => {
  it('uses a persisted manual count, including zero, and resumes automatic counts when cleared', () => {
    const books = [book({ isRead: true, dateRead: '2026-01-01' })];
    expect(goalProgress({ ...goal('BookCount', 10), completedCount: 6 }, books)).toMatchObject({
      completed: 6,
      percentage: 60,
    });
    expect(goalProgress({ ...goal('BookCount', 10), completedCount: 0 }, books).completed).toBe(0);
    expect(goalProgress({ ...goal('BookCount', 10), completedCount: null }, books).completed).toBe(
      1,
    );
  });
  it('counts finished books and known pages within the inclusive read date range', () => {
    const books = [
      book({ isRead: true, dateRead: '2026-01-01', pageCount: 100 }),
      book({ isRead: true, dateRead: '2026-01-31', pageCount: 200 }),
      book({ isRead: true, dateRead: '2026-01-15' }),
      book({ isRead: true, dateRead: '2025-12-31', pageCount: 500 }),
      book({ isRead: true, dateRead: '2026-02-01', pageCount: 500 }),
      book({ isRead: true, pageCount: 500 }),
      book({ isRead: true, isDnf: true, dateRead: '2026-01-15', pageCount: 500 }),
      book({ dateRead: '2026-01-15', pageCount: 500 }),
    ];
    expect(goalProgress(goal('BookCount', 5), books)).toMatchObject({
      title: 'Books',
      completed: 3,
      percentage: 60,
    });
    expect(goalProgress(goal('PageCount', 500), books)).toMatchObject({
      title: 'Pages',
      completed: 300,
      percentage: 60,
    });
  });

  it('uses the whole library for read percentage and counts DNF once', () => {
    const result = goalProgress(goal('ReadBookPercentage', 75), [
      book({ isRead: true }),
      book({ isRead: true, isDnf: true }),
      book({ isDnf: true }),
      book(),
    ]);
    expect(result).toMatchObject({
      title: 'Library Read Percentage',
      completed: 75,
      percentage: 100,
    });
    expect(goalProgress(goal('ReadBookPercentage', 75), []).percentage).toBe(0);
  });

  for (const [count, percentage, color] of [
    [80, 80, '#254d3c'],
    [81, 81, '#a13e29'],
    [120, 120, '#a13e29'],
  ] as const) {
    it(`counts acquisitions and makes buying progress ${percentage}% use ${color}`, () => {
      const books = Array.from({ length: count }, () => book({ dateAcquired: '2026-01-15' }));
      books.push(
        book({ dateAcquired: '2025-12-31' }),
        book({ dateAcquired: '2026-02-01' }),
        book(),
      );
      expect(goalProgress(goal('BuyBookCount'), books)).toMatchObject({
        title: 'Book Buying Limit',
        completed: count,
        percentage,
        color,
        fill: Math.min(100, percentage),
      });
    });
  }

  it('handles zero targets without dividing by zero', () => {
    expect(goalProgress(goal('BookCount', 0), []).percentage).toBe(100);
    expect(goalProgress(goal('BuyBookCount', 0), []).percentage).toBe(0);
    expect(
      goalProgress(goal('BuyBookCount', 0), [book({ dateAcquired: '2026-01-01' })]),
    ).toMatchObject({ percentage: 100, color: '#a13e29' });
  });
});
