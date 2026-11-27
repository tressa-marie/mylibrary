import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { LibraryBookSummary, SavedOwnedBook } from '../../models/owned-book-api';
import { OwnedBookService } from '../../services/owned-book.service';

@Component({
  selector: 'app-mark-read-dialog',
  imports: [FormsModule],
  templateUrl: './mark-read-dialog.html',
  styleUrl: './mark-read-dialog.scss',
})
export class MarkReadDialog {
  private readonly service = inject(OwnedBookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly form = viewChild.required<NgForm>('ratingForm');
  private trigger?: HTMLElement;
  private fallback?: HTMLElement;
  readonly saved = output<SavedOwnedBook>();
  protected readonly book = signal<LibraryBookSummary | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<string[]>([]);
  protected readonly submitted = signal(false);
  protected rating: number | null = null;

  open(book: LibraryBookSummary, trigger: HTMLElement, fallback: HTMLElement) {
    if (this.saving()) return;
    this.book.set(book);
    this.trigger = trigger;
    this.fallback = fallback;
    this.rating = book.rating ?? null;
    this.form().resetForm({ rating: this.rating });
    this.submitted.set(false);
    this.error.set('');
    this.fieldErrors.set([]);
    this.dialog().nativeElement.showModal();
  }

  protected cancel() {
    if (!this.saving()) this.dialog().nativeElement.close();
  }

  protected onClosed() {
    (this.trigger?.isConnected ? this.trigger : this.fallback)?.focus();
  }

  protected submit(form: NgForm, input: HTMLInputElement) {
    if (this.saving()) return;
    this.submitted.set(true);
    if (form.invalid || this.rating === null) {
      form.control.markAllAsTouched();
      input.focus();
      return;
    }
    this.save(this.rating);
  }

  protected skip() {
    this.save();
  }

  private save(rating?: number) {
    const book = this.book();
    if (!book || this.saving()) return;
    this.error.set('');
    this.fieldErrors.set([]);
    this.saving.set(true);
    this.service
      .markRead(book.id, rating)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.trigger = this.fallback;
          this.saved.emit(saved);
          this.dialog().nativeElement.close();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set('Your book could not be updated. Please try again.');
          if (error.status === 400 && error.error?.errors)
            this.fieldErrors.set(
              Object.values(error.error.errors as Record<string, string[]>).flat(),
            );
        },
      });
  }
}
