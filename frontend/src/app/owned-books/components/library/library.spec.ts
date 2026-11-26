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

  function header(label: string): HTMLTableCellElement {
    return Array.from(element.querySelectorAll<HTMLTableCellElement>('thead th')).find(
      (th) => th.querySelector('.header-label')?.textContent?.trim() === label,
    )!;
  }

  function clickHeader(label: string) {
    header(label).querySelector('button')!.click();
    fixture.detectChanges();
  }

  function rowIds() {
    return Array.from(element.querySelectorAll('tbody th a'), (link) =>
      link.getAttribute('href')!.split('/').at(-1),
    );
  }

  const filterBooks = [
    { id: 'zulu', title: 'Zulu', genres: ['Fantasy'], isRead: true, shelfLocation: 'Living room' },
    {
      id: 'alpha',
      title: 'Alpha',
      genres: ['fantasy', 'Adventure'],
      isRead: false,
      shelfLocation: 'Study',
    },
    { id: 'beta', title: 'Beta', genres: ['Mystery'], isRead: true, shelfLocation: 'Study' },
    { id: 'gamma', title: 'Gamma', genres: [], isRead: false, shelfLocation: null },
    { id: 'delta', title: 'Delta', genres: ['Fantasy'], isRead: true, shelfLocation: 'Study' },
  ];

  async function chooseFilter(id: string, label: string) {
    const select = element.querySelector<HTMLSelectElement>(`#${id}`)!;
    select.selectedIndex = Array.from(select.options).findIndex(
      (option) => option.textContent?.trim() === label,
    );
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('builds unique filter options and combines genre, read status, and shelf filters', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    const options = (id: string) =>
      Array.from(element.querySelector<HTMLSelectElement>(`#${id}`)!.options, (option) =>
        option.textContent?.trim(),
      );
    expect(options('genre-filter')).toEqual([
      'All genres',
      'No genre',
      'Adventure',
      'Fantasy',
      'Mystery',
    ]);
    await chooseFilter('genre-filter', 'Adventure');
    expect(rowIds()).toEqual(['alpha']);
    expect(options('shelf-filter')).toEqual(['All shelves', 'No shelf', 'Living room', 'Study']);
    await chooseFilter('genre-filter', 'Fantasy');
    expect(rowIds()).toEqual(['alpha', 'delta', 'zulu']);
    await chooseFilter('read-filter', 'Read');
    expect(rowIds()).toEqual(['delta', 'zulu']);
    await chooseFilter('shelf-filter', 'Study');
    expect(rowIds()).toEqual(['delta']);
    expect(element.querySelector('.book-count')).toBeNull();
    expect(options('shelf-filter')).toContain('Living room');
    await chooseFilter('read-filter', 'Unread');
    expect(rowIds()).toEqual(['alpha']);
  });

  it('shows no matches, keeps the controls available, and clears filters without changing sorting', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    clickHeader('Title');
    await chooseFilter('genre-filter', 'Mystery');
    await chooseFilter('shelf-filter', 'Living room');
    expect(rowIds()).toEqual([]);
    expect(element.textContent).toContain('No books match your filters');
    expect(element.textContent).not.toContain('Your library is empty');
    expect(element.querySelector('.filters')).toBeTruthy();
    expect(element.querySelector('.book-count')).toBeNull();
    element.querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await fixture.whenStable();
    expect(rowIds()).toEqual(['zulu', 'gamma', 'delta', 'beta', 'alpha']);
    expect(header('Title').getAttribute('aria-sort')).toBe('descending');
    expect(element.textContent).not.toContain('No books match your filters');
    expect(element.querySelector<HTMLButtonElement>('.clear-filters')!.disabled).toBe(true);
  });

  it('filters missing genre and shelf values and retains sorting within the filtered results', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    await chooseFilter('genre-filter', 'No genre');
    await chooseFilter('shelf-filter', 'No shelf');
    expect(rowIds()).toEqual(['gamma']);
    await chooseFilter('genre-filter', 'All genres');
    await chooseFilter('shelf-filter', 'All shelves');
    await chooseFilter('read-filter', 'Read');
    expect(rowIds()).toEqual(['beta', 'delta', 'zulu']);
    clickHeader('Title');
    expect(rowIds()).toEqual(['zulu', 'delta', 'beta']);
  });

  for (const [field, label] of [
    ['title', 'Title'],
    ['author', 'Author'],
    ['shelfLocation', 'Shelf location'],
  ]) {
    it(`sorts ${label} alphabetically in both directions and marks only the active header`, () => {
      const records = [
        { id: 'a', title: 'One', [field]: 'zebra' },
        { id: 'b', title: 'Two', [field]: 'Apple' },
        { id: 'c', title: 'Three', [field]: 'mango' },
      ];
      if (field !== 'title') records.push({ id: 'd', title: 'Missing', [field]: '' });
      http.expectOne('/api/library/books').flush(records);
      fixture.detectChanges();
      if (field !== 'title') clickHeader(label);
      expect(rowIds()).toEqual(field === 'title' ? ['b', 'c', 'a'] : ['b', 'c', 'a', 'd']);
      expect(header(label).getAttribute('aria-sort')).toBe('ascending');
      expect(header(label).querySelector('.sort-arrow')?.textContent?.trim()).toBe('↑');
      clickHeader(label);
      expect(rowIds()).toEqual(field === 'title' ? ['a', 'c', 'b'] : ['a', 'c', 'b', 'd']);
      expect(header(label).getAttribute('aria-sort')).toBe('descending');
      expect(header(label).querySelector('.sort-arrow')?.textContent?.trim()).toBe('↓');
      expect(element.querySelectorAll('thead .sort-arrow').length).toBe(1);
      expect(element.querySelectorAll('thead [aria-sort]').length).toBe(1);
      clickHeader(label);
      expect(rowIds()).toEqual(field === 'title' ? ['b', 'c', 'a'] : ['b', 'c', 'a', 'd']);
    });
  }

  it('sorts ratings numerically, including zero and decimals, with missing ratings last', () => {
    http.expectOne('/api/library/books').flush([
      { id: 'high', title: 'High', isRead: true, rating: 4.5 },
      { id: 'unread', title: 'Unread', isRead: false, rating: 4 },
      { id: 'zero', title: 'Zero', isRead: true, rating: 0 },
      { id: 'missing', title: 'Missing', isRead: true, rating: null },
      { id: 'low', title: 'Low', isRead: true, rating: 2 },
    ]);
    fixture.detectChanges();
    clickHeader('Rating');
    expect(rowIds()).toEqual(['zero', 'low', 'high', 'unread', 'missing']);
    expect(header('Rating').getAttribute('aria-sort')).toBe('ascending');
    clickHeader('Rating');
    expect(rowIds()).toEqual(['high', 'low', 'zero', 'unread', 'missing']);
    expect(header('Rating').getAttribute('aria-sort')).toBe('descending');
    clickHeader('Author');
    expect(header('Author').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Rating').hasAttribute('aria-sort')).toBe(false);
    expect(header('Rating').querySelector('.sort-arrow')).toBeNull();
  });

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
        genres: [],
        isRead: false,
        rating: 4,
        shelfLocation: null,
      },
      {
        id: '1',
        title: 'A Wizard of Earthsea',
        author: 'Ursula K. Le Guin',
        genres: ['Fantasy'],
        isRead: true,
        rating: 0,
        shelfLocation: 'Living room, shelf 2',
      },
      {
        id: '3',
        title: 'Unrated',
        author: '',
        genres: [],
        isRead: true,
        rating: null,
        shelfLocation: '',
      },
    ]);
    fixture.detectChanges();
    expect(
      Array.from(element.querySelectorAll('thead th:not(.edit-cell)'), (th) =>
        (th.querySelector('.header-label') ?? th).textContent?.trim(),
      ),
    ).toEqual(['Title', 'Author', 'Genres', 'Read status', 'Rating', 'Shelf location']);
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('A Wizard of Earthsea');
    expect(rows[0].textContent).toContain('Ursula K. Le Guin');
    expect(rows[0].textContent).toContain('Fantasy');
    expect(rows[0].textContent).toContain('Read');
    expect(rows[0].querySelectorAll('td:not(.edit-cell)')[3].textContent?.trim()).toBe('0');
    expect(rows[0].textContent).toContain('Living room, shelf 2');
    expect(
      Array.from(rows[1].querySelectorAll('td:not(.edit-cell)'), (td) => td.textContent?.trim()),
    ).toEqual(['-', '-', 'Read', '-', '-']);
    expect(
      Array.from(rows[2].querySelectorAll('td:not(.edit-cell)'), (td) => td.textContent?.trim()),
    ).toEqual(['Second Author', '-', 'Unread', '-', '-']);
  });

  it('shows an empty state with ways to add books', () => {
    http.expectOne('/api/library/books').flush([]);
    fixture.detectChanges();
    expect(element.textContent).toContain('Your library is empty');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.add-book')?.getAttribute('href')).toBe('/search');
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
