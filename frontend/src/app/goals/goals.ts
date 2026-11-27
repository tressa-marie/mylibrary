import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { OwnedBookService } from '../owned-books/services/owned-book.service';

@Component({
  selector: 'app-goals',
  imports: [FormsModule],
  templateUrl: './goals.html',
  styleUrl: './goals.scss',
})
export class Goals {
  private readonly library = inject(OwnedBookService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly currentReadPercentage = signal<number | null>(null);
  protected readonly percentageState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly goalTypes = [
    {
      value: 'PageCount',
      label: 'Page Count',
      description: 'Commit to reading a set number of pages',
    },
    {
      value: 'BookCount',
      label: 'Book Count',
      description: 'Commit to reading a set number of books',
    },
    {
      value: 'BuyBookCount',
      label: 'Buying Books',
      description: 'Limit the number of books you buy',
    },
    {
      value: 'ReadBookPercentage',
      label: 'Read My Library',
      description: 'Commit to reading a percentage of your library',
    },
  ];
  protected readonly selectedType = signal<string | null>(null);
  protected readonly step = signal<'type' | 'details'>('type');
  protected countDrafts = {
    BookCount: { num: null as number | null, startDate: '', endDate: '' },
    PageCount: { num: null as number | null, startDate: '', endDate: '' },
    BuyBookCount: { num: null as number | null, startDate: '', endDate: '' },
    ReadBookPercentage: { num: null as number | null, startDate: '', endDate: '' },
  };

  protected get countDraft() {
    if (this.selectedType() === 'ReadBookPercentage') return this.countDrafts.ReadBookPercentage;
    if (this.selectedType() === 'BuyBookCount') return this.countDrafts.BuyBookCount;
    return this.selectedType() === 'PageCount'
      ? this.countDrafts.PageCount
      : this.countDrafts.BookCount;
  }

  protected open(dialog: HTMLDialogElement) {
    this.selectedType.set(null);
    this.step.set('type');
    this.countDrafts = {
      BookCount: { num: null, startDate: '', endDate: '' },
      PageCount: { num: null, startDate: '', endDate: '' },
      BuyBookCount: { num: null, startDate: '', endDate: '' },
      ReadBookPercentage: { num: null, startDate: '', endDate: '' },
    };
    dialog.showModal();
  }

  protected next(event: Event, title: HTMLElement) {
    event.preventDefault();
    if (!this.selectedType()) return;
    this.step.set('details');
    if (this.selectedType() === 'ReadBookPercentage') this.loadReadPercentage();
    title.focus();
  }

  protected loadReadPercentage() {
    this.percentageState.set('loading');
    this.currentReadPercentage.set(null);
    this.library
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (books) => {
          const readCount = books.filter((book) => book.isRead || book.isDnf).length;
          this.currentReadPercentage.set(
            books.length ? Math.round((readCount / books.length) * 1000) / 10 : 0,
          );
          this.percentageState.set('ready');
        },
        error: () => this.percentageState.set('error'),
      });
  }
}
