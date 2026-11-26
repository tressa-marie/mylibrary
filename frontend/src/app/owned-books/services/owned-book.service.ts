import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateOwnedBookRequest,
  LibraryBookSummary,
  SavedOwnedBook,
} from '../models/owned-book-api';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OwnedBookService {
  private readonly http = inject(HttpClient);
  private readonly bookCount = signal<number | null>(null);
  readonly totalBooks = this.bookCount.asReadonly();

  list() {
    return this.http
      .get<LibraryBookSummary[]>('/api/library/books')
      .pipe(tap((books) => this.bookCount.set(books.length)));
  }

  get(id: string) {
    return this.http.get<SavedOwnedBook>(`/api/library/books/${encodeURIComponent(id)}`);
  }

  create(book: CreateOwnedBookRequest) {
    return this.http
      .post<SavedOwnedBook>('/api/library/books', book)
      .pipe(tap(() => this.bookCount.update((count) => (count === null ? null : count + 1))));
  }

  update(id: string, book: CreateOwnedBookRequest) {
    return this.http.put<SavedOwnedBook>(`/api/library/books/${encodeURIComponent(id)}`, book);
  }
}
