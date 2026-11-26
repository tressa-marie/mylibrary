import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';
import { Shelf, ShelfService } from './shelf.service';

@Component({
  selector: 'app-shelves',
  imports: [FormsModule],
  templateUrl: './shelves.html',
  styleUrl: './shelves.scss',
})
export class Shelves implements OnInit {
  private readonly service = inject(ShelfService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('shelfDialog');
  private readonly addButton = viewChild.required<ElementRef<HTMLButtonElement>>('addButton');
  private readonly form = viewChild.required<NgForm>('shelfForm');
  private listRequest?: Subscription;
  protected readonly shelves = signal<Shelf[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly fieldErrors = signal<string[]>([]);
  protected readonly successMessage = signal('');
  protected draft = { name: '', room: '', description: '' };

  ngOnInit() {
    this.loadShelves();
  }

  protected loadShelves() {
    this.listRequest?.unsubscribe();
    this.state.set('loading');
    this.listRequest = this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (shelves) => {
          this.shelves.set([...shelves].sort((a, b) => a.name.localeCompare(b.name)));
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  protected open() {
    this.draft = { name: '', room: '', description: '' };
    this.form().resetForm(this.draft);
    this.saveError.set('');
    this.fieldErrors.set([]);
    this.successMessage.set('');
    this.dialog().nativeElement.showModal();
  }

  protected close() {
    if (!this.saving()) this.dialog().nativeElement.close();
  }

  protected onClosed() {
    this.addButton().nativeElement.focus();
  }

  protected onCancel(event: Event) {
    if (this.saving()) event.preventDefault();
  }

  protected save(form: NgForm) {
    if (this.saving()) return;
    this.saveError.set('');
    this.fieldErrors.set([]);
    if (form.invalid || !this.draft.name.trim()) {
      form.control.markAllAsTouched();
      this.saveError.set('Enter a shelf name and correct any invalid fields.');
      return;
    }
    this.saving.set(true);
    this.service
      .create({
        name: this.draft.name.trim(),
        room: this.draft.room.trim() || null,
        description: this.draft.description.trim() || null,
        bookIds: [],
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (shelf) => {
          this.dialog().nativeElement.close();
          this.successMessage.set(`${shelf.name} was created.`);
          this.loadShelves();
        },
        error: (error: HttpErrorResponse) => {
          this.saveError.set(
            'Your shelf could not be saved. Your entries are still here. Please try again.',
          );
          if (error.status === 400 && error.error?.errors) {
            const errors = error.error.errors as Record<string, string[]>;
            this.fieldErrors.set(Object.values(errors).flat());
          }
        },
      });
  }
}
