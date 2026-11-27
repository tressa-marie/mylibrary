import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'goals',
    loadComponent: () => import('./goals/goals').then((m) => m.Goals),
    title: 'Goals | My Library',
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/stats').then((m) => m.Stats),
    title: 'Stats | My Library',
  },
  {
    path: 'coming-soon',
    loadComponent: () =>
      import('./shared/components/coming-soon/coming-soon').then((m) => m.ComingSoon),
    title: 'Coming Soon | My Library',
  },
  {
    path: 'library/books/:id/edit',
    loadComponent: () =>
      import('./owned-books/components/add-book/add-book').then((m) => m.AddBook),
    title: 'Edit book | My Library',
  },
  {
    path: 'shelves',
    loadComponent: () => import('./shelves/shelves').then((m) => m.Shelves),
    title: 'Shelves | My Library',
  },
  {
    path: 'library/books/:id',
    loadComponent: () =>
      import('./owned-books/components/book-details/book-details').then((m) => m.BookDetails),
    title: 'Book details | My Library',
  },
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
    loadComponent: () =>
      import('./search/components/book-search/book-search').then((m) => m.BookSearch),
    title: 'Search books | My Library',
  },
  {
    path: '',
    loadComponent: () => import('./owned-books/components/library/library').then((m) => m.Library),
    title: 'My Library',
  },
  { path: '**', redirectTo: '' },
];
