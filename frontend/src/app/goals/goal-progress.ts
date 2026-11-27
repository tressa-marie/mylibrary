import { Goal } from './goal.service';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';

export function goalProgress(goal: Goal, books: LibraryBookSummary[]) {
  const withinGoal = (date: string | null | undefined) =>
    !!date && date >= goal.startDate && date <= goal.endDate;
  const finished = books.filter((book) => book.isRead && !book.isDnf && withinGoal(book.dateRead));
  const calculated =
    goal.goalType === 'ReadBookPercentage'
      ? books.length
        ? (books.filter((book) => book.isRead || book.isDnf).length / books.length) * 100
        : 0
      : goal.goalType === 'BuyBookCount'
        ? books.filter((book) => withinGoal(book.dateAcquired)).length
        : goal.goalType === 'PageCount'
          ? finished.reduce((sum, book) => sum + (book.pageCount ?? 0), 0)
          : finished.length;
  const completed = goal.completedCount ?? calculated;
  const buying = goal.goalType === 'BuyBookCount';
  const percentage =
    goal.goalType === 'ReadBookPercentage'
      ? completed
      : goal.num > 0
        ? (completed / goal.num) * 100
        : buying
          ? completed > 0
            ? 100
            : 0
          : 100;
  return {
    title: {
      BookCount: 'Books Read',
      PageCount: 'Pages Read',
      ReadBookPercentage: 'Library Read Percentage',
      BuyBookCount: 'Book Buying Limit',
    }[goal.goalType],
    completed,
    percentage: Math.round(percentage * 10) / 10,
    fill: Math.min(100, Math.max(0, percentage)),
    color: buying && percentage > 80 ? '#a13e29' : '#254d3c',
  };
}
