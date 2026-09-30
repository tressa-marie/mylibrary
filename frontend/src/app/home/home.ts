import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HealthService } from '../core/health.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly health = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly connection = signal<'checking' | 'connected' | 'unavailable'>('checking');

  ngOnInit() {
    this.checkConnection();
  }

  protected checkConnection() {
    this.connection.set('checking');
    this.health
      .check()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) =>
          this.connection.set(response.status === 'Healthy' ? 'connected' : 'unavailable'),
        error: () => this.connection.set('unavailable'),
      });
  }
}
