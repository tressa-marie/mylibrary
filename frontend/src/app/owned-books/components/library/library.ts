import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LibraryBookSummary } from '../../models/owned-book-api';
import { OwnedBookService } from '../../services/owned-book.service';

type SortField = 'title' | 'author' | 'shelfLocation' | 'rating';

@Component({
  selector: 'app-library',
  imports: [RouterLink, FormsModule],
  templateUrl: './library.html',
  styleUrl: './library.scss',
})
export class Library implements OnInit {
  private readonly service = inject(OwnedBookService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly books = signal<LibraryBookSummary[]>([]);
  protected readonly pageSize = signal(25);
  protected readonly pageIndex = signal(0);
  protected readonly genreFilter = signal<string | null>(null);
  protected readonly readFilter = signal<'all' | 'read' | 'unread'>('all');
  protected readonly shelfFilter = signal<string | null>(null);
  protected readonly genreOptions = computed(() =>
    this.filterOptions(this.books().flatMap((book) => book.genres ?? [])),
  );
  protected readonly shelfOptions = computed(() =>
    this.filterOptions(this.books().map((book) => book.shelfLocation)),
  );
  protected readonly hasFilters = computed(
    () => this.genreFilter() !== null || this.readFilter() !== 'all' || this.shelfFilter() !== null,
  );
  private readonly filteredBooks = computed(() =>
    this.books().filter(
      (book) =>
        (this.genreFilter() === null ||
          (this.genreFilter() === ''
            ? !book.genres?.length
            : book.genres?.some((genre) => this.filterValue(genre) === this.genreFilter()))) &&
        (this.readFilter() === 'all' ||
          (this.readFilter() === 'read' ? book.isRead : !book.isRead)) &&
        (this.shelfFilter() === null ||
          this.filterValue(book.shelfLocation) === this.shelfFilter()),
    ),
  );
  protected readonly sortField = signal<SortField>('title');
  protected readonly sortDirection = signal<'ascending' | 'descending'>('ascending');
  private readonly collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  protected readonly sortedBooks = computed(() => {
    const field = this.sortField();
    const direction = this.sortDirection() === 'ascending' ? 1 : -1;
    const value = (book: LibraryBookSummary): string | number | null =>
      field === 'rating'
        ? book.isRead
          ? (book.rating ?? null)
          : null
        : (field === 'title'
            ? book.title?.trim().replace(/^(?:a|an|the)\s+/i, '')
            : book[field]?.trim()) || null;
    return [...this.filteredBooks()].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      // Missing values stay at the bottom in either direction.
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : this.collator.compare(String(left), String(right));
      return comparison * direction;
    });
  });
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sortedBooks().length / this.pageSize())),
  );
  protected readonly pageStart = computed(() => this.pageIndex() * this.pageSize());
  protected readonly pageEnd = computed(() =>
    Math.min(this.pageStart() + this.pageSize(), this.sortedBooks().length),
  );
  protected readonly pagedBooks = computed(() =>
    this.sortedBooks().slice(this.pageStart(), this.pageEnd()),
  );
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit() {
    this.loadBooks();
  }

  private filterValue(value: string | null | undefined) {
    return value?.trim().toLocaleLowerCase() || '';
  }

  private filterOptions(values: (string | null | undefined)[]) {
    const options = new Map<string, string>();
    for (const entry of values) {
      const label = entry?.trim();
      const value = this.filterValue(label);
      if (label && !options.has(value)) options.set(value, label);
    }
    return Array.from(options, ([value, label]) => ({ value, label })).sort((a, b) =>
      this.collator.compare(a.label, b.label),
    );
  }

  protected clearFilters() {
    this.pageIndex.set(0);
    this.genreFilter.set(null);
    this.readFilter.set('all');
    this.shelfFilter.set(null);
  }

  protected changeGenre(value: string | null) {
    this.genreFilter.set(value);
    this.pageIndex.set(0);
  }

  protected changeReadStatus(value: 'all' | 'read' | 'unread') {
    this.readFilter.set(value);
    this.pageIndex.set(0);
  }

  protected changeShelf(value: string | null) {
    this.shelfFilter.set(value);
    this.pageIndex.set(0);
  }

  protected changePageSize(size: number) {
    if (![10, 25, 50].includes(size)) return;
    this.pageSize.set(size);
    this.pageIndex.set(0);
  }

  protected goToPage(index: number) {
    this.pageIndex.set(Math.max(0, Math.min(index, this.pageCount() - 1)));
  }

  protected openBook(id: string) {
    void this.router.navigate(['/library/books', id]);
  }

  protected sortBy(field: SortField) {
    this.pageIndex.set(0);
    if (this.sortField() === field) {
      this.sortDirection.update((direction) =>
        direction === 'ascending' ? 'descending' : 'ascending',
      );
    } else {
      this.sortField.set(field);
      this.sortDirection.set('ascending');
    }
  }

  protected loadBooks() {
    this.state.set('loading');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (books) => {
          this.pageIndex.set(0);
          this.books.set(books.map((book) => ({ ...book, genres: book.genres ?? [] })));
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
