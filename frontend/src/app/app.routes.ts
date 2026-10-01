import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'search',
    loadComponent: () => import('./books/books').then((m) => m.Books),
    title: 'Search books | My Library',
  },
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
    title: 'My Library',
  },
  { path: '**', redirectTo: '' },
];
