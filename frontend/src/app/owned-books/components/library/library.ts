import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LibraryBookSummary } from '../../models/owned-book-api';
import { OwnedBookService } from '../../services/owned-book.service';
import { GenreColor } from '../../../shared/genre-color';

type SortField = 'title' | 'author' | 'shelfLocation' | 'rating';
type FilterKey = 'genre' | 'read' | 'shelf';
type FilterSelections = Record<FilterKey, string[]>;

@Component({
  selector: 'app-library',
  imports: [RouterLink, FormsModule, GenreColor],
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly appliedFilters = signal<FilterSelections>({ genre: [], read: [], shelf: [] });
  protected readonly draftSelection = signal<string[]>([]);
  protected readonly openFilter = signal<FilterKey | null>(null);
  protected readonly genreOptions = computed(() =>
    this.filterOptions(this.books().flatMap((book) => book.genres ?? [])),
  );
  protected readonly shelfOptions = computed(() =>
    this.filterOptions(this.books().map((book) => book.shelfLocation)),
  );
  protected readonly filters = computed(() => [
    {
      key: 'genre' as const,
      label: 'Genre',
      allLabel: 'All genres',
      options: [{ value: '', label: 'No genre' }, ...this.genreOptions()],
    },
    {
      key: 'read' as const,
      label: 'Read status',
      allLabel: 'All books',
      options: [
        { value: 'read', label: 'Read' },
        { value: 'unread', label: 'Unread' },
      ],
    },
    {
      key: 'shelf' as const,
      label: 'Shelf',
      allLabel: 'All shelves',
      options: [{ value: '', label: 'No shelf' }, ...this.shelfOptions()],
    },
  ]);
  protected readonly hasFilters = computed(() =>
    this.filters().some((filter) =>
      filter.options.some((option) => !this.appliedFilters()[filter.key].includes(option.value)),
    ),
  );
  private readonly filteredBooks = computed(() =>
    this.books().filter(
      (book) =>
        (book.genres.length ? book.genres : ['']).some((genre) =>
          this.appliedFilters().genre.includes(this.filterValue(genre)),
        ) &&
        this.appliedFilters().read.includes(book.isRead ? 'read' : 'unread') &&
        this.appliedFilters().shelf.includes(this.filterValue(book.shelfLocation)),
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
    const selections: FilterSelections = { genre: [], read: [], shelf: [] };
    for (const filter of this.filters()) {
      selections[filter.key] = filter.options.map((option) => option.value);
    }
    this.appliedFilters.set(selections);
    this.openFilter.set(null);
    this.draftSelection.set([]);
  }

  protected toggleFilter(key: FilterKey) {
    if (this.openFilter() === key) {
      this.openFilter.set(null);
      return;
    }
    this.draftSelection.set([...this.appliedFilters()[key]]);
    this.openFilter.set(key);
  }

  protected toggleSelection(value: string) {
    this.draftSelection.update((selection) =>
      selection.includes(value)
        ? selection.filter((item) => item !== value)
        : [...selection, value],
    );
  }

  protected selectAll(key: FilterKey) {
    this.draftSelection.set(
      this.filters()
        .find((filter) => filter.key === key)!
        .options.map((option) => option.value),
    );
  }

  protected applyFilter(key: FilterKey, event: Event) {
    event.preventDefault();
    this.appliedFilters.update((filters) => ({ ...filters, [key]: [...this.draftSelection()] }));
    this.pageIndex.set(0);
    this.closeFilter(true);
  }

  protected filterSummary(key: FilterKey) {
    const filter = this.filters().find((entry) => entry.key === key)!;
    const selection = this.appliedFilters()[key];
    if (!selection.length) return 'None selected';
    if (selection.length === filter.options.length) return filter.allLabel;
    if (selection.length === 1)
      return filter.options.find((option) => option.value === selection[0])?.label;
    return `${selection.length} selected`;
  }

  private closeFilter(restoreFocus = false) {
    const key = this.openFilter();
    this.openFilter.set(null);
    if (restoreFocus && key)
      this.element.nativeElement.querySelector<HTMLButtonElement>(`#${key}-filter`)?.focus();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    const key = this.openFilter();
    const field = key && this.element.nativeElement.querySelector(`#${key}-filter-field`);
    if (field && !field.contains(event.target as Node)) this.closeFilter();
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.closeFilter(true);
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
          this.clearFilters();
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
