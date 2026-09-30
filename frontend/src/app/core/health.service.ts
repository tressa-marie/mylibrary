import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';

export interface HealthResponse {
  status: string;
  service: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  check() {
    return this.http.get<HealthResponse>('/api/health').pipe(timeout(5000));
  }
}
