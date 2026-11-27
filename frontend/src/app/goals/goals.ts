import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { OwnedBookService } from '../owned-books/services/owned-book.service';
import { Goal, GoalService } from './goal.service';
import { GoalProgressCard } from './goal-progress-card';
import { EditGoalDialog } from './edit-goal-dialog';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';

@Component({
  selector: 'app-goals',
  imports: [FormsModule, GoalProgressCard, EditGoalDialog],
  templateUrl: './goals.html',
  styleUrl: './goals.scss',
})
export class Goals implements OnInit {
  private readonly goalService = inject(GoalService);
  private readonly library = inject(OwnedBookService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly goalsState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly progressBooks = signal<LibraryBookSummary[]>([]);
  protected readonly progressState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly fieldErrors = signal<string[]>([]);
  protected readonly successMessage = signal('');
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
  ] as const;
  protected readonly selectedType = signal<Goal['goalType'] | null>(null);
  protected readonly step = signal<'type' | 'details'>('type');
  protected countDrafts = {
    BookCount: { num: null as number | null, startDate: '', endDate: '' },
    PageCount: { num: null as number | null, startDate: '', endDate: '' },
    BuyBookCount: { num: null as number | null, startDate: '', endDate: '' },
    ReadBookPercentage: { num: null as number | null, startDate: '', endDate: '' },
  };

  ngOnInit() {
    this.loadGoals();
  }

  protected onGoalSaved(goal: Goal) {
    this.goals.update((goals) =>
      goals.map((existing) => (existing.id === goal.id ? goal : existing)),
    );
    this.successMessage.set('Your goal was updated.');
  }

  protected onGoalDeleted(id: string) {
    this.goals.update((goals) => goals.filter((goal) => goal.id !== id));
    this.successMessage.set('Your goal was permanently deleted.');
  }

  protected loadGoals() {
    this.goalsState.set('loading');
    this.goalService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (goals) => {
          this.goals.set(goals);
          this.goalsState.set('ready');
          if (goals.length) this.loadProgressBooks();
        },
        error: () => this.goalsState.set('error'),
      });
  }

  protected loadProgressBooks() {
    this.progressState.set('loading');
    this.library
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (books) => {
          this.progressBooks.set(books);
          this.progressState.set('ready');
        },
        error: () => this.progressState.set('error'),
      });
  }

  protected get countDraft() {
    if (this.selectedType() === 'ReadBookPercentage') return this.countDrafts.ReadBookPercentage;
    if (this.selectedType() === 'BuyBookCount') return this.countDrafts.BuyBookCount;
    return this.selectedType() === 'PageCount'
      ? this.countDrafts.PageCount
      : this.countDrafts.BookCount;
  }

  protected open(dialog: HTMLDialogElement) {
    if (this.saving()) return;
    this.saveError.set('');
    this.fieldErrors.set([]);
    this.successMessage.set('');
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
    this.saveError.set('');
    this.fieldErrors.set([]);
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

  protected submitGoal(form: NgForm, element: HTMLFormElement, dialog: HTMLDialogElement) {
    if (this.saving()) return;
    this.saveError.set('');
    this.fieldErrors.set([]);
    if (form.invalid) {
      form.control.markAllAsTouched();
      element.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }
    const goalType = this.selectedType();
    const draft = this.countDraft;
    if (!goalType || draft.num === null) return;
    if (!Number.isInteger(draft.num)) {
      this.saveError.set('Enter a whole number for your goal target.');
      element.querySelector<HTMLInputElement>('#goal-count')?.focus();
      return;
    }
    if (draft.endDate < draft.startDate) {
      this.saveError.set('End date must be on or after start date.');
      element.querySelector<HTMLInputElement>('#goal-end-date')?.focus();
      return;
    }
    this.saving.set(true);
    this.goalService
      .create({
        goalType,
        num: draft.num,
        startDate: draft.startDate,
        endDate: draft.endDate,
        includeNonLibraryBooks: false,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          dialog.close();
          this.successMessage.set('Your goal was created.');
          this.loadGoals();
        },
        error: (error: HttpErrorResponse) => {
          this.saveError.set(
            'Your goal could not be saved. Your entries are still here. Please try again.',
          );
          if (error.status === 400 && error.error?.errors) {
            this.fieldErrors.set(
              Object.values(error.error.errors as Record<string, string[]>).flat(),
            );
          }
        },
      });
  }
}
