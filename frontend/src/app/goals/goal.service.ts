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
  completedCount?: number | null;
}

export type CreateGoalRequest = Omit<Goal, 'id'>;

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Goal[]>('/api/goals').pipe(timeout(15000));
  }

  create(goal: CreateGoalRequest) {
    return this.http.post<Goal>('/api/goals', goal).pipe(timeout(15000));
  }

  update(id: string, goal: CreateGoalRequest) {
    return this.http.put<Goal>(`/api/goals/${encodeURIComponent(id)}`, goal).pipe(timeout(15000));
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/goals/${encodeURIComponent(id)}`).pipe(timeout(15000));
  }
}
