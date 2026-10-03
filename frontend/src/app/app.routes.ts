import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'add-book',
    loadComponent: () =>
      import('./owned-books/components/add-book/add-book').then((m) => m.AddBook),
    title: 'Add book | My Library',
  },
  {
    path: 'owned-books/add-book',
    loadComponent: () =>
      import('./owned-books/components/add-book/add-book').then((m) => m.AddBook),
    title: 'Add book | My Library',
  },
  {
    path: 'search',
    loadComponent: () => import('./search/components/book-search/book-search').then((m) => m.BookSearch),
    title: 'Search books | My Library',
  },
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
    title: 'My Library',
  },
  { path: '**', redirectTo: '' },
];
