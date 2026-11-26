import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Book, BookService } from '../../services/book.service';

@Component({
  selector: 'app-book-detail-dialog',
  imports: [RouterLink],
  templateUrl: './book-detail-dialog.html',
  styleUrl: './book-detail-dialog.scss',
})
export class BookDetailDialog {
  private readonly service = inject(BookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('details');
  private detailRequest?: Subscription;
  private returnFocus?: HTMLElement;
  protected readonly selected = signal<Book | null>(null);
  protected readonly detailState = signal<'loading' | 'ready' | 'error'>('loading');

  open(book: Book, returnFocus?: HTMLElement) {
    this.detailRequest?.unsubscribe();
    if (returnFocus) this.returnFocus = returnFocus;
    this.selected.set(book);
    this.detailState.set('loading');
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
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
    this.dialog().nativeElement.close();
  }

  protected onClosed() {
    this.detailRequest?.unsubscribe();
    this.returnFocus?.focus();
    this.returnFocus = undefined;
  }

}
