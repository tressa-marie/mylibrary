import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, EMPTY, startWith, Subject, switchMap } from 'rxjs';
import { SavedOwnedBook } from '../../models/owned-book-api';
import { OwnedBookService } from '../../services/owned-book.service';

@Component({
  selector: 'app-book-details',
  imports: [RouterLink],
  templateUrl: './book-details.html',
  styleUrl: './book-details.scss',
})
export class BookDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(OwnedBookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly book = signal<SavedOwnedBook | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  protected readonly coverFailed = signal(false);

  ngOnInit() {
    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => {
          this.state.set('loading');
          this.book.set(null);
          this.coverFailed.set(false);
          return this.service.get(params.get('id')!).pipe(
            catchError((error: HttpErrorResponse) => {
              this.state.set(error.status === 404 ? 'missing' : 'error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((book) => {
        this.book.set({ ...book, genres: book.genres ?? [] });
        this.state.set('ready');
      });
  }

  protected retry() {
    this.reload.next();
  }
}
