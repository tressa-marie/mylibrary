import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';

export interface CreateShelfRequest {
  name: string;
  room: string | null;
  description: string | null;
  bookIds: string[];
}

export interface Shelf extends CreateShelfRequest {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class ShelfService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Shelf[]>('/api/shelves').pipe(timeout(15000));
  }

  create(shelf: CreateShelfRequest) {
    return this.http.post<Shelf>('/api/shelves', shelf).pipe(timeout(15000));
  }

  update(id: string, shelf: CreateShelfRequest) {
    return this.http.put<Shelf>(`/api/shelves/${encodeURIComponent(id)}`, shelf).pipe(timeout(15000));
  }
}
