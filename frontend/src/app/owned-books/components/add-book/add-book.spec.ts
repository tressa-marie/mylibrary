import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { Book } from '../../../search/services/book.service';
import { AddBook } from './add-book';

describe('Add book', () => {
  it('fills the form after an asynchronous response with only one book request', async () => {
    const originalUrl = window.location.href;
    window.history.replaceState(null, '', '/add-book?bookId=ADbRywEACAAJ');
    TestBed.configureTestingModule({
      imports: [AddBook],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      const save = http.expectOne('/api/library/books');
      expect(save.request.method).toBe('POST');
      expect(navigate).not.toHaveBeenCalled();
      expect(save.request.body).toMatchObject({
        sourceBookId: book.id,
        title: book.title,
        author: 'Erin Morgenstern',
        isbn: '9781784702861',
        format: book.format,
        publicationYear: book.publicationYear,
        publisher: book.publisher,
        pageCount: book.pageCount,
      });
      save.flush({
        ...save.request.body,
        id: 'saved-id',
        editionId: 'edition-id',
        createdAtUtc: '2026-11-25T12:00:00Z',
      });
      await fixture.whenStable();
      expect(element.textContent).toContain('The Starless Sea was added to your library.');
      expect(navigate).toHaveBeenCalledExactlyOnceWith(['/']);
      http.verify();
    } finally {
      fixture.destroy();
      window.history.replaceState(null, '', originalUrl);
    }
  });
});

describe('Add book saving', () => {
  let fixture: ComponentFixture<AddBook>;
  let http: HttpTestingController;
  let originalUrl: string;
  let router: Router;

  beforeEach(async () => {
    originalUrl = window.location.href;
    window.history.replaceState(null, '', '/add-book');
    TestBed.configureTestingModule({
      imports: [AddBook],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AddBook);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    window.history.replaceState(null, '', originalUrl);
  });

  async function enterTitle(title: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#title');
    input.value = title;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function submit() {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    button.click();
  }

  it('rejects whitespace titles without sending a save request', async () => {
    await enterTitle('   ');
    submit();
    await fixture.whenStable();
    http.expectNone('/api/library/books');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Enter a title',
    );
  });

  it('saves metadata once, clears an unread rating, and navigates only after success', async () => {
    await enterTitle('  My Book  ');
    fixture.componentInstance.book.author = 'An Author';
    const genre: HTMLInputElement = fixture.nativeElement.querySelector('#genre');
    genre.value = ' Fantasy ';
    genre.dispatchEvent(new Event('input'));
    const shelf: HTMLInputElement = fixture.nativeElement.querySelector('#shelf-location');
    shelf.value = ' Living room, shelf 2 ';
    shelf.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.componentInstance.book.rating = 4;
    fixture.componentInstance.bookId = 'source-id';
    submit();
    submit();
    const request = http.expectOne('/api/library/books');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      title: 'My Book',
      author: 'An Author',
      genre: 'Fantasy',
      shelfLocation: 'Living room, shelf 2',
      sourceBookId: 'source-id',
      isRead: false,
      rating: null,
    });
    expect(fixture.componentInstance.book.title).toBe('  My Book  ');
    expect(router.navigate).not.toHaveBeenCalled();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    request.flush({
      ...request.request.body,
      id: 'saved-id',
      editionId: 'edition-id',
      createdAtUtc: '2026-10-10T12:00:00Z',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('My Book was added to your library.');
    expect(fixture.nativeElement.querySelector('#title').value).toBe('');
    expect(fixture.componentInstance.bookId).toBeNull();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/']);
    await enterTitle('Second Book');
    submit();
    const second = http.expectOne('/api/library/books');
    expect(second.request.body).toMatchObject({
      title: 'Second Book',
      author: '',
      sourceBookId: null,
      genre: null,
      shelfLocation: null,
    });
    second.flush({ ...second.request.body, id: 'second-id', createdAtUtc: '2026-10-10T12:01:00Z' });
    await fixture.whenStable();
  });

  it('preserves input on validation failure and allows retry', async () => {
    await enterTitle('My Book');
    submit();
    http
      .expectOne('/api/library/books')
      .flush(
        { errors: { isbn: ['Enter a valid ISBN.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#title').value).toBe('My Book');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Enter a valid ISBN.',
    );
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
    submit();
    const retry = http.expectOne('/api/library/books');
    retry.flush({ ...retry.request.body, id: 'saved-id', createdAtUtc: '2026-10-10T12:00:00Z' });
    await fixture.whenStable();
    expect(fixture.componentInstance.successMessage()).toContain('added to your library');
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/']);
  });

  it('keeps entries and enables retry when the library service is unreachable', async () => {
    await enterTitle('My Book');
    submit();
    http.expectOne('/api/library/books').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#title').value).toBe('My Book');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Could not reach the library service',
    );
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(fixture.componentInstance.successMessage()).toBe('');
    expect(router.navigate).not.toHaveBeenCalled();
    submit();
    const retry = http.expectOne('/api/library/books');
    retry.flush({
      ...retry.request.body,
      id: 'saved-id',
      editionId: 'edition-id',
      createdAtUtc: '2026-11-25T12:00:00Z',
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.successMessage()).toContain('added to your library');
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/']);
  });
});
