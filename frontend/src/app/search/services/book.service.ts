import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publicationYear: number | null;
  isbns: string[];
  format: string | null;
  coverUrl: string | null;
  publisher: string | null;
  description: string | null;
  pageCount: number | null;
  language: string | null;
}
export type SearchField = 'all' | 'title' | 'author' | 'isbn';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);

  search(query: string, field: SearchField) {
    return this.http
      .get<{ books: Book[] }>('/api/books', { params: { query, field } })
      .pipe(timeout(15000));
  }

  get(id: string) {
    return this.http.get<Book>(`/api/books/${encodeURIComponent(id)}`).pipe(timeout(15000));
  }
}
