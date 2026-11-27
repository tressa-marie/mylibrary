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
    const dialog = element.querySelector<HTMLDialogElement>('app-mark-read-dialog dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
  });
  afterEach(() => http.verify());

  it('opens the rating modal, cancels without changes, and updates the filtered table after Skip', async () => {
    const unread = {
      id: 'unread',
      title: 'Unread',
      isRead: false,
      rating: 4.5,
      genres: [],
      shelfLocation: null,
    };
    http
      .expectOne('/api/library/books')
      .flush([unread, { id: 'read', title: 'Read', isRead: true, rating: 2, genres: [] }]);
    await fixture.whenStable();
    await chooseFilter('read-filter', 'Unread');
    const dialog = element.querySelector<HTMLDialogElement>('app-mark-read-dialog dialog')!;
    element.querySelector<HTMLButtonElement>('.row-book')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Cancel')!
      .click();
    await fixture.whenStable();
    expect(rowIds()).toEqual(['unread']);
    http.expectNone((request) => request.method === 'PATCH');
    element.querySelector<HTMLButtonElement>('.row-book')!.click();
    await fixture.whenStable();
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Skip')!
      .click();
    const request = http.expectOne({ method: 'PATCH', url: '/api/library/books/unread/read' });
    expect(request.request.body).toEqual({
      dateRead: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    request.flush({ ...unread, isRead: true });
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(rowIds()).toEqual([]);
    expect(element.textContent).toContain('No books match your filters');
    element.querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await fixture.whenStable();
    expect(rowIds()).toEqual(['read', 'unread']);
    expect(element.querySelectorAll('.row-book').length).toBe(0);
    expect(
      element.querySelector('a[href="/library/books/unread"]')?.closest('tr')?.textContent,
    ).toContain('4.5');
  });

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

  const pageBooks = Array.from({ length: 56 }, (_, index) => ({
    id: `book-${index + 1}`,
    title: `Book ${String(index + 1).padStart(3, '0')}`,
    author: 'Author',
    genres: [index % 2 ? 'Mystery' : 'Fantasy'],
    isRead: index % 3 === 0,
    rating: null,
    shelfId: null,
    shelfLocation: index % 2 ? 'Study' : 'Living room',
  }));

  async function navigatePage(label: string) {
    element.querySelector<HTMLButtonElement>(`.pagination button[aria-label="${label}"]`)!.click();
    await fixture.whenStable();
  }

  async function setPageSize(size: number) {
    const select = element.querySelector<HTMLSelectElement>('#books-per-page')!;
    select.selectedIndex = Array.from(select.options).findIndex(
      (option) => option.textContent?.trim() === String(size),
    );
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('defaults to 25 rows and handles first, previous, next, and last pages without more requests', async () => {
    http.expectOne('/api/library/books').flush(pageBooks);
    await fixture.whenStable();
    expect(rowIds().length).toBe(25);
    expect(rowIds()[0]).toBe('book-1');
    expect(element.querySelector('.page-range')?.textContent).toBe('1–25 of 56');
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!.disabled).toBe(
      true,
    );
    await navigatePage('Next page');
    expect(rowIds()[0]).toBe('book-26');
    expect(element.querySelector('.page-range')?.textContent).toBe('26–50 of 56');
    await navigatePage('Last page');
    expect(rowIds()).toEqual(['book-51', 'book-52', 'book-53', 'book-54', 'book-55', 'book-56']);
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.disabled).toBe(
      true,
    );
    await navigatePage('Previous page');
    expect(rowIds()[0]).toBe('book-26');
    await navigatePage('First page');
    expect(rowIds()[0]).toBe('book-1');
    http.expectNone('/api/library/books');
  });

  it('resets the page on page-size and filter changes, and sorts the full filtered set', async () => {
    http.expectOne('/api/library/books').flush(pageBooks);
    await fixture.whenStable();
    await setPageSize(50);
    expect(rowIds().length).toBe(50);
    await navigatePage('Last page');
    await setPageSize(10);
    expect(rowIds()).toEqual(pageBooks.slice(0, 10).map((book) => book.id));
    await navigatePage('Next page');
    await chooseFilter('genre-filter', 'Mystery');
    expect(rowIds()[0]).toBe('book-2');
    expect(element.querySelector('.page-range')?.textContent).toBe('1–10 of 28');
    await navigatePage('Next page');
    await chooseFilter('read-filter', 'Read');
    expect(element.querySelector('.page-range')?.textContent).toBe('1–9 of 9');
    clickHeader('Title');
    expect(rowIds()[0]).toBe('book-52');
    element.querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await fixture.whenStable();
    expect(rowIds()[0]).toBe('book-56');
    expect(rowIds().length).toBe(10);
    expect(element.querySelector('.page-range')?.textContent).toBe('1–10 of 56');
  });

  it('paginates a 500-book library after numeric sorting across the entire collection', async () => {
    const books = Array.from({ length: 500 }, (_, index) => ({
      id: `book-${index}`,
      title: `Book ${index}`,
      author: 'Author',
      genres: [],
      isRead: true,
      rating: index % 6,
      shelfLocation: null,
    }));
    http.expectOne('/api/library/books').flush(books);
    await fixture.whenStable();
    await setPageSize(50);
    await navigatePage('Next page');
    clickHeader('Rating');
    expect(rowIds().length).toBe(50);
    expect(element.querySelector('.page-range')?.textContent).toBe('1–50 of 500');
    expect(
      Array.from(element.querySelectorAll('tbody tr'), (row) =>
        row.querySelectorAll('td:not(.edit-cell)')[3].textContent?.trim(),
      ),
    ).toEqual(Array(50).fill('0'));
    clickHeader('Rating');
    expect(
      Array.from(element.querySelectorAll('tbody tr'), (row) =>
        row.querySelectorAll('td:not(.edit-cell)')[3].textContent?.trim(),
      ),
    ).toEqual(Array(50).fill('5'));
    await navigatePage('Last page');
    expect(element.querySelector('.page-range')?.textContent).toBe('451–500 of 500');
    expect(rowIds().length).toBe(50);
  });

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
    await openDropdown(id);
    await clickFilterAction('Clear selection');
    if (label.startsWith('All ')) await clickFilterAction('Select all');
    else await toggleOption(label);
    await clickFilterAction('Apply filters');
  }

  async function openDropdown(id: string) {
    element.querySelector<HTMLButtonElement>(`#${id}`)!.click();
    await fixture.whenStable();
  }

  async function clickFilterAction(label: string) {
    Array.from(element.querySelectorAll<HTMLButtonElement>('.filter-panel button'))
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await fixture.whenStable();
  }

  async function toggleOption(label: string) {
    Array.from(element.querySelectorAll<HTMLLabelElement>('.filter-option'))
      .find((option) => option.textContent?.trim() === label)!
      .querySelector<HTMLInputElement>('input')!
      .click();
    await fixture.whenStable();
  }

  it('builds unique filter options and combines genre, read status, and shelf filters', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    const options = async (id: string) => {
      await openDropdown(id);
      const labels = Array.from(element.querySelectorAll('.filter-option'), (option) =>
        option.textContent?.trim(),
      );
      await openDropdown(id);
      return labels;
    };
    expect(await options('genre-filter')).toEqual(['No genre', 'Adventure', 'Fantasy', 'Mystery']);
    await chooseFilter('genre-filter', 'Adventure');
    expect(rowIds()).toEqual(['alpha']);
    expect(await options('shelf-filter')).toEqual(['No shelf', 'Living room', 'Study']);
    await chooseFilter('genre-filter', 'Fantasy');
    expect(rowIds()).toEqual(['alpha', 'delta', 'zulu']);
    await chooseFilter('read-filter', 'Read');
    expect(rowIds()).toEqual(['delta', 'zulu']);
    await chooseFilter('shelf-filter', 'Study');
    expect(rowIds()).toEqual(['delta']);
    expect(element.querySelector('.book-count')).toBeNull();
    expect(await options('shelf-filter')).toContain('Living room');
    await chooseFilter('read-filter', 'Unread');
    expect(rowIds()).toEqual(['alpha']);
  });

  it('starts with all options checked in each dropdown and restores them when filters are reset', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    for (const id of ['genre-filter', 'read-filter', 'shelf-filter']) {
      await openDropdown(id);
      const checkboxes = Array.from(
        element.querySelectorAll<HTMLInputElement>('.filter-option input'),
      );
      expect(checkboxes.length).toBeGreaterThan(0);
      expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
      expect(element.querySelector('.filter-hint')).toBeNull();
      await openDropdown(id);
    }
    expect(element.querySelector<HTMLButtonElement>('.clear-filters')!.disabled).toBe(true);
    await chooseFilter('genre-filter', 'Fantasy');
    element.querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await fixture.whenStable();
    expect(rowIds().length).toBe(5);
    await openDropdown('genre-filter');
    expect(element.querySelectorAll('.filter-option input:checked').length).toBe(4);
  });

  for (const key of ['genre', 'read', 'shelf']) {
    it(`matches no books when the ${key} selection is empty and applied`, async () => {
      http.expectOne('/api/library/books').flush(filterBooks);
      await fixture.whenStable();
      await openDropdown(`${key}-filter`);
      await clickFilterAction('Clear selection');
      expect(rowIds().length).toBe(5);
      await clickFilterAction('Apply filters');
      expect(rowIds()).toEqual([]);
      expect(element.querySelector(`#${key}-summary`)?.textContent).toBe('None selected');
      await openDropdown(`${key}-filter`);
      expect(element.querySelectorAll('.filter-option input:checked').length).toBe(0);
      await clickFilterAction('Select all');
      expect(rowIds()).toEqual([]);
      await clickFilterAction('Apply filters');
      expect(rowIds().length).toBe(5);
    });
  }

  it('stages multiple selections and bulk actions until submitted', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    await openDropdown('genre-filter');
    await clickFilterAction('Clear selection');
    await toggleOption('Adventure');
    await toggleOption('Mystery');
    expect(rowIds()).toEqual(['alpha', 'beta', 'delta', 'gamma', 'zulu']);
    expect(element.querySelector('#genre-summary')?.textContent).toBe('All genres');
    await clickFilterAction('Apply filters');
    expect(rowIds()).toEqual(['alpha', 'beta']);
    expect(element.querySelector('#genre-summary')?.textContent).toBe('2 selected');
    await openDropdown('genre-filter');
    await clickFilterAction('Select all');
    expect(element.querySelectorAll('.filter-option input:checked').length).toBe(4);
    expect(rowIds()).toEqual(['alpha', 'beta']);
    await clickFilterAction('Apply filters');
    expect(rowIds().length).toBe(5);
    await chooseFilter('genre-filter', 'Fantasy');
    await openDropdown('genre-filter');
    await clickFilterAction('Clear selection');
    expect(element.querySelectorAll('.filter-option input:checked').length).toBe(0);
    expect(rowIds()).toEqual(['alpha', 'delta', 'zulu']);
    await clickFilterAction('Apply filters');
    expect(rowIds()).toEqual([]);
    expect(element.querySelector('#genre-summary')?.textContent).toBe('None selected');
    await chooseFilter('genre-filter', 'All genres');
    await openDropdown('read-filter');
    await clickFilterAction('Clear selection');
    await toggleOption('Read');
    await toggleOption('Unread');
    await clickFilterAction('Apply filters');
    expect(rowIds().length).toBe(5);
    await openDropdown('shelf-filter');
    await clickFilterAction('Clear selection');
    await toggleOption('Study');
    await toggleOption('Living room');
    await clickFilterAction('Apply filters');
    expect(rowIds()).toEqual(['alpha', 'beta', 'delta', 'zulu']);
  });

  it('discards unsubmitted changes when dismissed or another filter is opened', async () => {
    http.expectOne('/api/library/books').flush(filterBooks);
    await fixture.whenStable();
    await chooseFilter('genre-filter', 'Mystery');
    await openDropdown('genre-filter');
    await toggleOption('Fantasy');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('.filter-panel')).toBeNull();
    expect(document.activeElement?.id).toBe('genre-filter');
    await openDropdown('genre-filter');
    expect(element.querySelectorAll('.filter-option input:checked').length).toBe(1);
    await toggleOption('Fantasy');
    await openDropdown('shelf-filter');
    expect(rowIds()).toEqual(['beta']);
    document.body.click();
    await fixture.whenStable();
    expect(element.querySelector('.filter-panel')).toBeNull();
    await openDropdown('genre-filter');
    expect(element.querySelectorAll('.filter-option input:checked').length).toBe(1);
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

  it('ignores leading A, An, and The when sorting titles in either direction', () => {
    http.expectOne('/api/library/books').flush([
      { id: 'window', title: 'A Window' },
      { id: 'zebra', title: 'Zebra' },
      { id: 'apple', title: 'Apple' },
      { id: 'ocean', title: 'an Ocean' },
      { id: 'animal', title: 'Animal Farm' },
      { id: 'the', title: 'The Hobbit' },
      { id: 'bridge', title: 'a Bridge' },
    ]);
    fixture.detectChanges();
    const ascending = ['animal', 'apple', 'bridge', 'the', 'ocean', 'window', 'zebra'];
    expect(rowIds()).toEqual(ascending);
    expect(element.querySelector('a[href="/library/books/window"]')?.textContent?.trim()).toBe(
      'A Window',
    );
    clickHeader('Title');
    expect(rowIds()).toEqual([...ascending].reverse());
  });

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
    expect(element.querySelector('#library-title')?.textContent).toBe('My Library');
    expect(
      element.querySelector('thead tr')?.lastElementChild?.classList.contains('edit-cell'),
    ).toBe(true);
    expect(rows[2].lastElementChild?.classList.contains('edit-cell')).toBe(true);
    expect(rows[2].lastElementChild?.querySelector('.row-edit')?.getAttribute('href')).toBe(
      '/library/books/2/edit',
    );
    expect(element.querySelectorAll('.row-book').length).toBe(1);
    const unreadIcon = rows[2].querySelector<HTMLButtonElement>('.row-book')!;
    expect(unreadIcon.previousElementSibling?.classList.contains('row-edit')).toBe(true);
    let rowClicked = false;
    rows[2].addEventListener('click', () => {
      rowClicked = true;
    });
    unreadIcon.click();
    expect(rowClicked).toBe(false);
    expect(rows[1].textContent).toContain('A Wizard of Earthsea');
    expect(rows[1].textContent).toContain('Ursula K. Le Guin');
    expect(rows[1].textContent).toContain('Fantasy');
    expect(rows[1].textContent).toContain('Read');
    expect(rows[1].querySelectorAll('td:not(.edit-cell)')[3].textContent?.trim()).toBe('0');
    expect(rows[1].textContent).toContain('Living room, shelf 2');
    expect(
      Array.from(rows[0].querySelectorAll('td:not(.edit-cell)'), (td) => td.textContent?.trim()),
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
