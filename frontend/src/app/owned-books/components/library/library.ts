import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SavedOwnedBook } from '../../models/owned-book-api';
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
  protected readonly books = signal<SavedOwnedBook[]>([]);
  protected readonly genreFilter = signal<string | null>(null);
  protected readonly readFilter = signal<'all' | 'read' | 'unread'>('all');
  protected readonly shelfFilter = signal<string | null>(null);
  protected readonly genreOptions = computed(() => this.optionsFor('genre'));
  protected readonly shelfOptions = computed(() => this.optionsFor('shelfLocation'));
  protected readonly hasFilters = computed(
    () => this.genreFilter() !== null || this.readFilter() !== 'all' || this.shelfFilter() !== null,
  );
  private readonly filteredBooks = computed(() =>
    this.books().filter(
      (book) =>
        (this.genreFilter() === null || this.filterValue(book.genre) === this.genreFilter()) &&
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
    const value = (book: SavedOwnedBook): string | number | null =>
      field === 'rating'
        ? book.isRead
          ? (book.rating ?? null)
          : null
        : book[field]?.trim() || null;
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
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit() {
    this.loadBooks();
  }

  private filterValue(value: string | null | undefined) {
    return value?.trim().toLocaleLowerCase() || '';
  }

  private optionsFor(field: 'genre' | 'shelfLocation') {
    const options = new Map<string, string>();
    for (const book of this.books()) {
      const label = book[field]?.trim();
      const value = this.filterValue(label);
      if (label && !options.has(value)) options.set(value, label);
    }
    return Array.from(options, ([value, label]) => ({ value, label })).sort((a, b) =>
      this.collator.compare(a.label, b.label),
    );
  }

  protected clearFilters() {
    this.genreFilter.set(null);
    this.readFilter.set('all');
    this.shelfFilter.set(null);
  }

  protected openBook(id: string) {
    void this.router.navigate(['/library/books', id]);
  }

  protected sortBy(field: SortField) {
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
          this.books.set(books);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
