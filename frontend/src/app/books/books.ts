import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Book, BookService, SearchField } from '../core/book.service';

@Component({
  selector: 'app-books',
  imports: [FormsModule],
  templateUrl: './books.html',
  styleUrl: './books.scss',
})
export class Books {
  private readonly service = inject(BookService);
  private readonly destroyRef = inject(DestroyRef);
  private searchRequest?: Subscription;
  private detailRequest?: Subscription;
  private returnFocus?: HTMLElement;
  protected readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('details');
  protected query = '';
  protected field: SearchField = 'all';
  protected readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly books = signal<Book[]>([]);
  protected readonly selected = signal<Book | null>(null);
  protected readonly detailState = signal<'loading' | 'ready' | 'error'>('loading');
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
    this.detailRequest?.unsubscribe();
    if (event) this.returnFocus = event.currentTarget as HTMLElement;
    this.selected.set(book);
    this.detailState.set('loading');
    this.dialog()?.nativeElement.showModal();
    this.detailRequest = this.service
      .get(book.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selected.set(detail);
          this.detailState.set('ready');
        },
        error: () => this.detailState.set('error'),
      });
  }

  protected close() {
    this.dialog()?.nativeElement.close();
  }

  protected onClosed() {
    this.detailRequest?.unsubscribe();
    this.returnFocus?.focus();
  }

  protected coverFailed(id: string) {
    this.failedCovers.update((previous) => new Set([...previous, id]));
  }
}
