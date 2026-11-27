import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { finalize } from 'rxjs';
import { Goal, GoalService } from './goal.service';
import { goalProgress } from './goal-progress';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';

@Component({
  selector: 'app-edit-goal-dialog',
  imports: [FormsModule],
  templateUrl: './edit-goal-dialog.html',
  styleUrl: './edit-goal-dialog.scss',
})
export class EditGoalDialog {
  private readonly service = inject(GoalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly form = viewChild.required<NgForm>('editForm');
  private trigger?: HTMLButtonElement;
  private fallback?: HTMLButtonElement;
  private calculatedCount = 0;
  readonly saved = output<Goal>();
  readonly deleted = output<string>();
  protected readonly goal = signal<Goal | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<string[]>([]);
  protected readonly confirmingDelete = signal(false);
  protected readonly title = signal('');
  protected useCalculated = true;
  protected draft = {
    completedCount: null as number | null,
    num: null as number | null,
    startDate: '',
    endDate: '',
  };

  open(
    goal: Goal,
    books: LibraryBookSummary[],
    trigger: HTMLButtonElement,
    fallback: HTMLButtonElement,
  ) {
    if (this.busy()) return;
    this.trigger = trigger;
    this.fallback = fallback;
    this.goal.set(goal);
    const progress = goalProgress(goal, books);
    this.title.set(progress.title);
    this.calculatedCount = goalProgress({ ...goal, completedCount: null }, books).completed;
    this.useCalculated = goal.completedCount == null;
    this.draft = {
      completedCount: Math.round(progress.completed * 100) / 100,
      num: goal.num,
      startDate: goal.startDate,
      endDate: goal.endDate,
    };
    this.form().resetForm({ ...this.draft, useCalculated: this.useCalculated });
    this.error.set('');
    this.fieldErrors.set([]);
    this.confirmingDelete.set(false);
    this.dialog().nativeElement.showModal();
  }

  protected restoreCalculated(checked: boolean) {
    this.useCalculated = checked;
    if (checked) this.draft.completedCount = Math.round(this.calculatedCount * 100) / 100;
  }

  protected close() {
    if (!this.busy()) this.dialog().nativeElement.close();
  }

  protected onClosed() {
    (this.trigger?.isConnected ? this.trigger : this.fallback)?.focus();
  }

  protected save(form: NgForm, element: HTMLFormElement) {
    if (this.busy()) return;
    this.error.set('');
    this.fieldErrors.set([]);
    const goal = this.goal();
    if (!goal) return;
    if (form.invalid || this.draft.num === null || this.draft.completedCount === null) {
      form.control.markAllAsTouched();
      this.error.set('Complete all required fields with valid values.');
      element.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }
    if (
      !Number.isInteger(this.draft.num) ||
      (!this.useCalculated &&
        goal.goalType !== 'ReadBookPercentage' &&
        !Number.isInteger(this.draft.completedCount))
    ) {
      this.error.set('Goal targets and completed counts must be whole numbers.');
      return;
    }
    if (this.draft.endDate < this.draft.startDate) {
      this.error.set('End date must be on or after start date.');
      return;
    }
    this.busy.set(true);
    this.service
      .update(goal.id, {
        goalType: goal.goalType,
        num: this.draft.num,
        startDate: this.draft.startDate,
        endDate: this.draft.endDate,
        includeNonLibraryBooks: goal.includeNonLibraryBooks,
        completedCount: this.useCalculated ? null : this.draft.completedCount,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.busy.set(false);
          this.saved.emit(saved);
          this.dialog().nativeElement.close();
        },
        error: (error: HttpErrorResponse) =>
          this.showError(
            error,
            'Your goal could not be saved. Your changes are still here. Please try again.',
          ),
      });
  }

  protected deleteGoal() {
    const goal = this.goal();
    if (!goal || !this.confirmingDelete() || this.busy()) return;
    this.error.set('');
    this.fieldErrors.set([]);
    this.busy.set(true);
    this.service
      .delete(goal.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.trigger = this.fallback;
          this.deleted.emit(goal.id);
          this.dialog().nativeElement.close();
        },
        error: (error: HttpErrorResponse) =>
          this.showError(error, 'Your goal could not be deleted. Please try again.'),
      });
  }

  private showError(error: HttpErrorResponse, message: string) {
    this.error.set(message);
    if (error.status === 400 && error.error?.errors)
      this.fieldErrors.set(Object.values(error.error.errors as Record<string, string[]>).flat());
  }
}
