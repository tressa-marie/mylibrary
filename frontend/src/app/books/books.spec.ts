import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Books } from './books';
import { Book } from '../core/book.service';

describe('Book search', () => {
  let fixture: ComponentFixture<Books>;
  let http: HttpTestingController;
  let element: HTMLElement;
  const book: Book = {
    id: 'edition-1',
    title: 'A book',
    subtitle: null,
    authors: ['An Author'],
    publicationYear: 2020,
    isbns: ['9781234567890'],
    format: 'eBook',
    coverUrl: '/api/books/edition-1/cover',
    publisher: 'Publisher',
    description: 'More about this book',
    pageCount: 123,
    language: 'en',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Books],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Books);
    fixture.detectChanges();
    element = fixture.nativeElement;
    const dialog = element.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
  });
  afterEach(() => http.verify());

  function search(query: string, field = 'all') {
    const input = element.querySelector('input')!;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    const select = element.querySelector('select')!;
    select.value = field;
    select.dispatchEvent(new Event('change'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('does not submit empty or whitespace searches', () => {
    search('   ');
    http.expectNone((r) => r.url === '/api/books');
    expect(element.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
  });

  for (const field of ['all', 'title', 'author', 'isbn']) {
    it(`sends ${field} queries only to My Library and displays results`, () => {
      search('  test  ', field);
      expect(element.textContent).toContain('Searching books');
      const request = http.expectOne(
        (r) => r.url === '/api/books' && r.params.get('field') === field,
      );
      expect(request.request.params.get('query')).toBe('test');
      request.flush({ books: [book] });
      fixture.detectChanges();
      for (const value of ['A book', 'An Author', '2020', '9781234567890', 'eBook'])
        expect(element.textContent).toContain(value);
      expect(element.querySelector('img')!.getAttribute('src')).toBe(book.coverUrl);
    });
  }

  it('shows no results, service errors, and allows retry', () => {
    search('missing');
    http.expectOne((r) => r.url === '/api/books').flush({ books: [] });
    fixture.detectChanges();
    expect(element.textContent).toContain('No books found');
    search('test');
    http
      .expectOne((r) => r.url === '/api/books')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')!.textContent).toContain("couldn't reach");
    search('retry');
    http.expectOne((r) => r.url === '/api/books').flush({ books: [book] });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('cancels stale searches', () => {
    search('first');
    const old = http.expectOne((r) => r.url === '/api/books');
    search('second');
    expect(old.cancelled).toBe(true);
    http.expectOne((r) => r.url === '/api/books').flush({ books: [] });
  });

  it('loads additional details, handles failure, and retries', () => {
    search('test');
    http.expectOne((r) => r.url === '/api/books').flush({ books: [book] });
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.title')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading book details');
    http.expectOne('/api/books/edition-1').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Book details are unavailable');
    element.querySelector<HTMLButtonElement>('dialog button:not(.close)')!.click();
    http.expectOne('/api/books/edition-1').flush(book);
    fixture.detectChanges();
    expect(element.querySelector('dialog')!.textContent).toContain('More about this book');
    expect(element.querySelector('dialog')!.textContent).toContain('123');
  });

  it('renders absent metadata and broken covers gracefully', () => {
    search('test');
    http
      .expectOne((r) => r.url === '/api/books')
      .flush({ books: [{ ...book, authors: [], isbns: [], publicationYear: null, format: null }] });
    fixture.detectChanges();
    element.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.textContent).toContain('No cover available');
    expect(element.textContent).toContain('Author unavailable');
    expect(element.textContent).toContain('Year unavailable');
  });
});
