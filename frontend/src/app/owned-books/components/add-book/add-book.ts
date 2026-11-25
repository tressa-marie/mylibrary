import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
  ],
})
export class AddBook implements OnInit {
  book = new OwnedBook();
  private readonly service = inject(BookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly ownedBookService = inject(OwnedBookService);
  private readonly router = inject(Router);
  private readonly shelfService = inject(ShelfService);
  readonly shelves = signal<Shelf[]>([]);
  readonly shelfState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly validationErrors = signal<string[]>([]);

  isRead = false;
  coverFailed = false;
  bookId: string | null = null;

  ngOnInit() {
    this.loadShelves();
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
    if (this.loading() || this.saving()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.validationErrors.set([]);
    if (form.invalid || !this.book.title.trim()) {
      form.control.markAllAsTouched();
      this.errorMessage.set('Enter a title and correct any invalid fields before adding the book.');
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
      shelfLocation: shelf ? `${shelf.name}${shelf.room ? ` (${shelf.room})` : ''}` : null,
      genre: optional(this.book.genre),
      publicationYear: this.book.publicationYear,
      publisher: optional(this.book.publisher),
      edition: optional(this.book.edition),
      pageCount: this.book.pageCount,
    };
    this.saving.set(true);
    this.ownedBookService
      .create(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => {
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
