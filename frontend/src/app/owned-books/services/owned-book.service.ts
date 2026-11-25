import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateOwnedBookRequest, SavedOwnedBook } from '../models/owned-book-api';

@Injectable({ providedIn: 'root' })
export class OwnedBookService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<SavedOwnedBook[]>('/api/library/books');
  }

  create(book: CreateOwnedBookRequest) {
    return this.http.post<SavedOwnedBook>('/api/library/books', book);
  }
}
