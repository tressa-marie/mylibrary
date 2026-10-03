import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Book } from '../../../search/services/book.service';
import { AddBook } from './add-book';

describe('Add book', () => {
  it('fills the form after an asynchronous response with only one book request', async () => {
    const originalUrl = window.location.href;
    window.history.replaceState(null, '', '/add-book?bookId=ADbRywEACAAJ');
    TestBed.configureTestingModule({
      imports: [AddBook],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AddBook);
    try {
      fixture.detectChanges();
      const request = http.expectOne('/api/books/ADbRywEACAAJ');
      await Promise.resolve();
      const book: Book = {
        id: 'ADbRywEACAAJ',
        title: 'The Starless Sea',
        subtitle: null,
        authors: ['Erin Morgenstern'],
        publicationYear: 2020,
        isbns: ['1784702862', '9781784702861'],
        format: 'Book (binding unspecified)',
        coverUrl: null,
        publisher: 'Vintage',
        description: null,
        pageCount: 498,
        language: 'en',
      };
      request.flush(book);
      // Let Angular schedule rendering; forcing detectChanges here would hide the bug.
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const expectedFields = {
        title: 'The Starless Sea',
        author: 'Erin Morgenstern',
        isbn: '9781784702861',
        format: 'Book (binding unspecified)',
        'publication-year': '2020',
        publisher: 'Vintage',
        'page-count': '498',
      };
      for (const [id, value] of Object.entries(expectedFields)) {
        expect(element.querySelector<HTMLInputElement>(`input#${id}`)?.value).toBe(value);
      }
      http.verify();
    } finally {
      fixture.destroy();
      window.history.replaceState(null, '', originalUrl);
    }
  });
});
