import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OwnedBook } from '../../models/owned-book';
import { Book, BookService } from '../../../search/services/book.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-add-book',
  templateUrl: './add-book.html',
  styleUrl: './add-book.scss',
  imports: [
    FormsModule,
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

  isRead = false;
  coverFailed = false;
  bookId: string | null = null;

  ngOnInit() {
    // Check if there's a bookId query parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    this.bookId = urlParams.get('bookId');
    if (this.bookId) {
      // Fetch the book details using the BookService
      this.service.get(this.bookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (book) => this.loadBook(book),
        error: () => {
          // Handle error if needed
        },
      });
    }
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

  addBook() {
    //TODO add book logic will go here
  }
}
