import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Library } from './library';

describe('Library', () => {
  let fixture: ComponentFixture<Library>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Library],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Library);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  it('loads saved books and renders all columns in title order', () => {
    expect(element.textContent).toContain('Loading your library');
    expect(element.querySelector('table')).toBeNull();
    const request = http.expectOne('/api/library/books');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        id: '2',
        title: 'Zebra',
        author: 'Second Author',
        genre: null,
        isRead: false,
        rating: 4,
        shelfLocation: null,
      },
      {
        id: '1',
        title: 'A Wizard of Earthsea',
        author: 'Ursula K. Le Guin',
        genre: 'Fantasy',
        isRead: true,
        rating: 0,
        shelfLocation: 'Living room, shelf 2',
      },
      {
        id: '3',
        title: 'Unrated',
        author: '',
        genre: '',
        isRead: true,
        rating: null,
        shelfLocation: '',
      },
    ]);
    fixture.detectChanges();
    expect(
      Array.from(element.querySelectorAll('thead th'), (th) => th.textContent?.trim()),
    ).toEqual(['Title', 'Author', 'Genre', 'Read status', 'Rating', 'Shelf location']);
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('A Wizard of Earthsea');
    expect(rows[0].textContent).toContain('Ursula K. Le Guin');
    expect(rows[0].textContent).toContain('Fantasy');
    expect(rows[0].textContent).toContain('Read');
    expect(rows[0].querySelectorAll('td')[3].textContent?.trim()).toBe('0');
    expect(rows[0].textContent).toContain('Living room, shelf 2');
    expect(Array.from(rows[1].querySelectorAll('td'), (td) => td.textContent?.trim())).toEqual([
      '-', '-', 'Read', '-', '-',
    ]);
    expect(Array.from(rows[2].querySelectorAll('td'), (td) => td.textContent?.trim())).toEqual([
      'Second Author', '-', 'Unread', '-', '-',
    ]);
  });

  it('shows an empty state with ways to add books', () => {
    http.expectOne('/api/library/books').flush([]);
    fixture.detectChanges();
    expect(element.textContent).toContain('Your library is empty');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('a[href="/add-book"]')).toBeTruthy();
    expect(element.querySelector('a[href="/search"]')).toBeTruthy();
  });

  it('shows a load error and supports retry', () => {
    http
      .expectOne('/api/library/books')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load your library',
    );
    expect(element.textContent).not.toContain('Your library is empty');
    element.querySelector('button')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading your library');
    http.expectOne('/api/library/books').flush([]);
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).toContain('Your library is empty');
  });
});
