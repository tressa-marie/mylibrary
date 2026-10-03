import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookDetailDialog } from '../book-detail-dialog/book-detail-dialog';
import { Book, BookService, SearchField } from '../../services/book.service';

@Component({
  selector: 'app-book-search',
  imports: [FormsModule, RouterLink, BookDetailDialog],
  templateUrl: './book-search.html',
  styleUrl: './book-search.scss',
})
export class BookSearch {
  private readonly service = inject(BookService);
  private readonly destroyRef = inject(DestroyRef);
  private searchRequest?: Subscription;
  private readonly detailDialog = viewChild.required(BookDetailDialog);
  protected query = '';
  protected field: SearchField = 'all';
  protected readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly books = signal<Book[]>([]);
  protected readonly failedCovers = signal<Set<string>>(new Set());

  protected search() {
    const query = this.query.trim();
    if (!query || query.length > 200) return;
    this.searchRequest?.unsubscribe();
    this.books.set([]);
    this.state.set('loading');
    this.searchRequest = this.service
      .search(query, this.field)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ books }) => {
          this.books.set(books);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  protected open(book: Book, event?: Event) {
    this.detailDialog().open(book, event?.currentTarget as HTMLElement | undefined);
  }

  protected coverFailed(id: string) {
    this.failedCovers.update((previous) => new Set([...previous, id]));
  }
}
