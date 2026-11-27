import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';

export interface Goal {
  id: string;
  startDate: string;
  endDate: string;
  goalType: 'BookCount' | 'PageCount' | 'BuyBookCount' | 'ReadBookPercentage';
  num: number;
  includeNonLibraryBooks: boolean;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Goal[]>('/api/goals').pipe(timeout(15000));
  }
}
