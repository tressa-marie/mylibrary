import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SavedOwnedBook } from '../../models/owned-book-api';
import { OwnedBookService } from '../../services/owned-book.service';

@Component({
  selector: 'app-library',
  imports: [RouterLink],
  templateUrl: './library.html',
  styleUrl: './library.scss',
})
export class Library implements OnInit {
  private readonly service = inject(OwnedBookService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly books = signal<SavedOwnedBook[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit() {
    this.loadBooks();
  }

  protected openBook(id: string) {
    void this.router.navigate(['/library/books', id]);
  }

  protected loadBooks() {
    this.state.set('loading');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (books) => {
          this.books.set([...books].sort((a, b) => a.title.localeCompare(b.title)));
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
