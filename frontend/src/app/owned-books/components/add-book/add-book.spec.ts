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
      http.expectOne('/api/shelves').flush([]);
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
    http.expectOne('/api/shelves').flush([
      { id: 'shelf-2', name: 'Study shelf', room: null, description: null, bookIds: [] },
      { id: 'shelf-1', name: 'Favorites', room: 'Living room', description: null, bookIds: [] },
    ]);
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

  async function enterGenre(value: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#genre');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await fixture.whenStable();
  }

  it('adds genre pills with Enter, ignores blanks and duplicates, and removes individual tags', async () => {
    await enterTitle('My Book');
    await enterGenre(' Fantasy ');
    await enterGenre('Adventure');
    await enterGenre('fantasy');
    await enterGenre('   ');
    expect(fixture.componentInstance.book.genres).toEqual(['Fantasy', 'Adventure']);
    expect(fixture.nativeElement.querySelectorAll('mat-chip-row').length).toBe(2);
    http.expectNone('/api/library/books');
    fixture.nativeElement.querySelector('button[aria-label="Remove Fantasy"]').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.book.genres).toEqual(['Adventure']);
    expect(fixture.nativeElement.querySelector('#genre').value).toBe('');
  });

  it('includes a pending genre when saving without pressing Enter', async () => {
    await enterTitle('My Book');
    const genre: HTMLInputElement = fixture.nativeElement.querySelector('#genre');
    genre.value = ' History ';
    genre.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    submit();
    const request = http.expectOne('/api/library/books');
    expect(request.request.body.genres).toEqual(['History']);
    request.flush({ ...request.request.body, id: 'saved-id' });
    await fixture.whenStable();
  });

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
    fixture.componentInstance.book.authorGender = 'unknown';
    const genre: HTMLInputElement = fixture.nativeElement.querySelector('#genre');
    genre.value = ' Fantasy ';
    genre.dispatchEvent(new Event('input'));
    genre.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    const shelf: HTMLSelectElement = fixture.nativeElement.querySelector('#shelf-location');
    expect(Array.from(shelf.options, (option) => option.textContent?.trim())).toEqual([
      'No shelf',
      'Favorites',
      'Study shelf',
    ]);
    shelf.selectedIndex = 1;
    shelf.dispatchEvent(new Event('change'));
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
      authorGender: 'unknown',
      genres: ['Fantasy'],
      shelfId: 'shelf-1',
      shelfLocation: 'Favorites (Living room)',
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
      genres: [],
      shelfLocation: null,
      shelfId: null,
    });
    second.flush({ ...second.request.body, id: 'second-id', createdAtUtc: '2026-10-10T12:01:00Z' });
    await fixture.whenStable();
  });

  it('preserves input on validation failure and allows retry', async () => {
    await enterTitle('My Book');
    const shelf: HTMLSelectElement = fixture.nativeElement.querySelector('#shelf-location');
    shelf.selectedIndex = 2;
    shelf.dispatchEvent(new Event('change'));
    await fixture.whenStable();
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
    expect(fixture.componentInstance.book.shelfId).toBe('shelf-2');
    submit();
    const retry = http.expectOne('/api/library/books');
    expect(retry.request.body.shelfId).toBe('shelf-2');
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

describe('Add book shelf loading', () => {
  let fixture: ComponentFixture<AddBook>;
  let http: HttpTestingController;
  let originalUrl: string;

  beforeEach(async () => {
    originalUrl = window.location.href;
    window.history.replaceState(null, '', '/add-book');
    TestBed.configureTestingModule({
      imports: [AddBook],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddBook);
    await fixture.whenStable();
  });
  afterEach(() => {
    http.verify();
    fixture.destroy();
    window.history.replaceState(null, '', originalUrl);
  });

  it('shows a loading state, then a no-shelf option and create link for an empty list', async () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Loading shelves');
    expect(element.querySelector<HTMLSelectElement>('#shelf-location')!.disabled).toBe(true);
    http.expectOne('/api/shelves').flush([]);
    await fixture.whenStable();
    expect(element.textContent).toContain('No shelves yet');
    expect(element.querySelector('a[href="/shelves"]')).toBeTruthy();
    const select = element.querySelector<HTMLSelectElement>('#shelf-location')!;
    expect(select.disabled).toBe(false);
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toBe('No shelf');
    expect(fixture.componentInstance.book.shelfId).toBeNull();
  });

  it('shows an error and loads options after a successful retry', async () => {
    http.expectOne('/api/shelves').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Shelves could not be loaded',
    );
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    http
      .expectOne('/api/shelves')
      .flush([{ id: 'shelf-1', name: 'Favorites', room: 'Study', description: null, bookIds: [] }]);
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    const select = element.querySelector<HTMLSelectElement>('#shelf-location')!;
    expect(select.disabled).toBe(false);
    expect(select.options[1].textContent?.trim()).toBe('Favorites');
  });
});
