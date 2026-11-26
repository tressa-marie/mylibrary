import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { OwnedBook } from '../../models/owned-book';
import { Book, BookService } from '../../../search/services/book.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OwnedBookService } from '../../services/owned-book.service';
import { CreateOwnedBookRequest } from '../../models/owned-book-api';
import { Shelf, ShelfService } from '../../../shelves/shelf.service';

@Component({
  selector: 'app-add-book',
  templateUrl: './add-book.html',
  styleUrl: './add-book.scss',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
  ],
})
export class AddBook implements OnInit {
  book = new OwnedBook();
  private readonly service = inject(BookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly ownedBookService = inject(OwnedBookService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly editId = signal<string | null>(null);
  readonly editLoaded = signal(false);
  readonly editLoadError = signal('');
  private originalShelfLocation: string | null = null;
  private originalShelfId: string | null = null;
  private readonly shelfService = inject(ShelfService);
  readonly shelves = signal<Shelf[]>([]);
  readonly shelfState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly validationErrors = signal<string[]>([]);
  readonly genreError = signal('');
  genreDraft = '';

  isRead = false;
  coverFailed = false;
  bookId: string | null = null;

  ngOnInit() {
    this.loadShelves();
    this.editId.set(this.route.snapshot.paramMap.get('id'));
    if (this.editId()) {
      this.loadSavedBook();
      return;
    }
    // Check if there's a bookId query parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    this.bookId = urlParams.get('bookId');
    if (this.bookId) {
      this.loading.set(true);
      // Fetch the book details using the BookService
      this.service
        .get(this.bookId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.loading.set(false)),
        )
        .subscribe({
          next: (book) => this.loadBook(book),
          error: () => {
            this.errorMessage.set('Book details could not be loaded. You can enter them manually.');
          },
        });
    }
  }

  loadSavedBook() {
    const id = this.editId();
    if (!id || this.loading()) return;
    this.loading.set(true);
    this.editLoaded.set(false);
    this.editLoadError.set('');
    this.ownedBookService
      .get(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.book = {
            title: saved.title,
            author: saved.author ?? '',
            description: saved.description ?? '',
            coverUrl: saved.coverUrl,
            isbn: saved.isbn ?? '',
            format: saved.format ?? '',
            authorGender: saved.authorGender ?? '',
            rating: saved.rating,
            purchaseLocation: saved.purchaseLocation ?? '',
            shelfId: saved.shelfId,
            genres: [...(saved.genres ?? [])],
            publicationYear: saved.publicationYear,
            publisher: saved.publisher ?? '',
            edition: saved.edition ?? '',
            pageCount: saved.pageCount,
          };
          this.isRead = saved.isRead;
          this.bookId = saved.sourceBookId;
          this.originalShelfLocation = saved.shelfLocation;
          this.originalShelfId = saved.shelfId;
          this.coverFailed = false;
          this.editLoaded.set(true);
          this.changeDetector.markForCheck();
        },
        error: (error: HttpErrorResponse) =>
          this.editLoadError.set(
            error.status === 404
              ? 'This book could not be found in your library.'
              : 'Book details could not be loaded. Please try again.',
          ),
      });
  }

  loadShelves() {
    this.shelfState.set('loading');
    this.shelfService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (shelves) => {
          this.shelves.set([...shelves].sort((a, b) => a.name.localeCompare(b.name)));
          this.shelfState.set('ready');
        },
        error: () => this.shelfState.set('error'),
      });
  }

  addGenre(event: MatChipInputEvent) {
    if (this.commitGenre(event.value)) {
      event.chipInput.clear();
      this.genreDraft = '';
    }
  }

  removeGenre(genre: string) {
    this.book.genres = this.book.genres.filter((value) => value !== genre);
  }

  private commitGenre(value: string) {
    const genre = value.trim();
    this.genreError.set('');
    if (genre.length > 100) {
      this.genreError.set('Use at most 100 characters for each genre.');
      return false;
    }
    if (
      genre &&
      !this.book.genres.some((value) => value.toLocaleLowerCase() === genre.toLocaleLowerCase())
    ) {
      this.book.genres = [...this.book.genres, genre];
    }
    return true;
  }

  loadBook(book: Book) {
    this.book.title = book.title;
    this.book.description = book.description ?? '';
    this.book.coverUrl = book.coverUrl;
    this.coverFailed = false;
    this.book.author = book.authors.join(', ');
    this.book.isbn = book.isbns.find((isbn) => isbn.length === 13) ?? book.isbns[0] ?? '';
    this.book.format = book.format ?? '';
    this.book.publicationYear = book.publicationYear;
    this.book.publisher = book.publisher ?? '';
    this.book.pageCount = book.pageCount;
    this.changeDetector.markForCheck();
  }

  addBook(form: NgForm) {
    if (this.loading() || this.saving() || (this.editId() && !this.editLoaded())) return;
    if (!this.commitGenre(this.genreDraft)) return;
    this.genreDraft = '';
    this.successMessage.set('');
    this.errorMessage.set('');
    this.validationErrors.set([]);
    if (form.invalid || !this.book.title.trim()) {
      form.control.markAllAsTouched();
      this.errorMessage.set('Enter a title and correct any invalid fields before saving the book.');
      return;
    }
    const optional = (value: string | null) => value?.trim() || null;
    const shelf = this.shelves().find((shelf) => shelf.id === this.book.shelfId);
    const request: CreateOwnedBookRequest = {
      sourceBookId: optional(this.bookId),
      title: this.book.title.trim(),
      author: this.book.author.trim(),
      isbn: optional(this.book.isbn.replace(/[\s-]/g, '').toUpperCase()),
      description: optional(this.book.description),
      coverUrl: this.book.coverUrl,
      format: optional(this.book.format),
      authorGender: optional(this.book.authorGender),
      isRead: this.isRead,
      rating: this.isRead ? this.book.rating : null,
      purchaseLocation: optional(this.book.purchaseLocation),
      shelfId: this.book.shelfId,
      // Keep the existing library and details location label populated.
      shelfLocation: shelf
        ? `${shelf.name}${shelf.room ? ` (${shelf.room})` : ''}`
        : this.book.shelfId === this.originalShelfId
          ? this.originalShelfLocation
          : null,
      genres: [...this.book.genres],
      publicationYear: this.book.publicationYear,
      publisher: optional(this.book.publisher),
      edition: optional(this.book.edition),
      pageCount: this.book.pageCount,
    };
    this.saving.set(true);
    const editId = this.editId();
    const save = editId
      ? this.ownedBookService.update(editId, request)
      : this.ownedBookService.create(request);
    save
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => {
          if (editId) {
            void this.router.navigate(['/library/books', saved.id]);
            return;
          }
          this.successMessage.set(`${saved.title} was added to your library.`);
          this.book = new OwnedBook();
          this.bookId = null;
          this.isRead = false;
          this.coverFailed = false;
          form.resetForm({ ...this.book, isRead: false });
          void this.router.navigate(['/']);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 0
              ? 'Could not reach the library service. Your entries are still here.'
              : 'Your book could not be saved. Correct any errors and try again.',
          );
          if (error.status === 400 && error.error?.errors) {
            const errors = error.error.errors as Record<string, string[]>;
            this.validationErrors.set(
              Object.entries(errors).flatMap(([field, messages]) =>
                messages.map((message) => `${field}: ${message}`),
              ),
            );
          }
        },
      });
  }
}
