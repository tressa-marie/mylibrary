import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { SavedOwnedBook } from '../../models/owned-book-api';

describe('Edit library book', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const id = 'd81fbd37-49a8-47b9-beff-77223da6c40b';
  const url = `/library/books/${id}/edit`;
  const saved: SavedOwnedBook = {
    id,
    editionId: 'edition-1',
    createdAtUtc: '2026-11-25T12:00:00Z',
    sourceBookId: 'source-volume',
    title: 'Saved Title',
    author: 'Saved Author',
    isbn: '9781784702861',
    description: 'Saved description',
    coverUrl: '/api/books/source-volume/cover',
    format: 'Paperback',
    authorGender: 'female',
    isRead: true,
    rating: 4.5,
    purchaseLocation: 'Bookshop',
    shelfId: 'shelf-1',
    shelfLocation: 'Favorites (Study)',
    genres: ['Fantasy', 'Adventure'],
    publicationYear: 2020,
    publisher: 'Publisher',
    edition: 'First',
    pageCount: 240,
  };
  const shelves = [
    { id: 'shelf-1', name: 'Favorites', room: 'Study', description: null, bookIds: [id] },
  ];
  const element = () => harness.routeNativeElement!;
  const saveButton = () => element().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  async function enterTitle(title: string) {
    const input = element().querySelector<HTMLInputElement>('#title')!;
    input.value = title;
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  }
  async function openEdit() {
    await harness.navigateByUrl(url);
    http.expectOne('/api/shelves').flush(shelves);
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    await harness.fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify());

  it('opens the edit form directly from the library row pencil without navigating to details', async () => {
    await harness.navigateByUrl('/');
    http.expectOne('/api/library/books').flush([saved]);
    harness.detectChanges();
    const pencil = element().querySelector<HTMLAnchorElement>('tbody .row-edit')!;
    expect(pencil.getAttribute('href')).toBe(url);
    expect(pencil.getAttribute('aria-label')).toBe('Edit Saved Title');
    expect(pencil.querySelector('svg')).toBeTruthy();
    pencil.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(url);
    http.expectOne('/api/shelves').flush(shelves);
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    await harness.fixture.whenStable();
    expect(element().querySelector('h2')!.textContent).toBe('Edit Book');
    expect(element().querySelector<HTMLInputElement>('#title')!.value).toBe(saved.title);
  });

  it('opens from the detail page, prefills every field, and PUTs changes before returning to details', async () => {
    await harness.navigateByUrl(`/library/books/${id}`);
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    harness.detectChanges();
    const edit = element().querySelector<HTMLAnchorElement>('.edit-book')!;
    expect(edit.textContent).toBe('Edit Book');
    expect(edit.getAttribute('href')).toBe(url);
    edit.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(url);
    expect(saveButton().disabled).toBe(true);
    http.expectOne('/api/shelves').flush(shelves);
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    await harness.fixture.whenStable();
    expect(element().querySelector('h2')?.textContent).toBe('Edit Book');
    const fields = {
      title: 'Saved Title',
      author: 'Saved Author',
      isbn: '9781784702861',
      rating: '4.5',
      description: 'Saved description',
      'purchase-location': 'Bookshop',
      'publication-year': '2020',
      publisher: 'Publisher',
      edition: 'First',
      format: 'Paperback',
      'page-count': '240',
    };
    for (const [field, value] of Object.entries(fields)) {
      expect(element().querySelector<HTMLInputElement>(`#${field}`)!.value).toBe(value);
    }
    expect(element().querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(
      element()
        .querySelector<HTMLSelectElement>('#shelf-location')!
        .selectedOptions[0].textContent?.trim(),
    ).toBe('Favorites');
    expect(saveButton().textContent?.trim()).toBe('Save');
    expect(element().querySelectorAll('mat-chip-row').length).toBe(2);
    element().querySelector<HTMLButtonElement>('button[aria-label="Remove Fantasy"]')!.click();
    const genreInput = element().querySelector<HTMLInputElement>('#genre')!;
    genreInput.value = 'Mystery';
    genreInput.dispatchEvent(new Event('input'));
    genreInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
    );
    await harness.fixture.whenStable();
    await enterTitle('Edited Title');
    saveButton().click();
    saveButton().click();
    const request = http.expectOne(`/api/library/books/${id}`);
    expect(request.request.method).toBe('PUT');
    const { id: ignoredId, editionId, createdAtUtc, ...editable } = saved;
    expect(request.request.body).toEqual({
      ...editable,
      title: 'Edited Title',
      genres: ['Adventure', 'Mystery'],
    });
    http.expectNone((req) => req.method === 'POST');
    expect(TestBed.inject(Router).url).toBe(url);
    request.flush({ ...saved, title: 'Edited Title' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/library/books/${id}`);
    http.expectOne(`/api/library/books/${id}`).flush({ ...saved, title: 'Edited Title' });
    harness.detectChanges();
    expect(element().querySelector('h1')!.textContent).toBe('Edited Title');
  });

  it('preserves edited input and selected shelf after a failed save, then permits retry', async () => {
    await openEdit();
    await enterTitle('Edited Title');
    saveButton().click();
    http
      .expectOne(`/api/library/books/${id}`)
      .flush(
        { errors: { title: ['Please correct the title.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(url);
    expect(element().querySelector<HTMLInputElement>('#title')!.value).toBe('Edited Title');
    expect(element().querySelector('[role="alert"]')!.textContent).toContain(
      'Please correct the title.',
    );
    expect(saveButton().disabled).toBe(false);
    saveButton().click();
    const retry = http.expectOne(`/api/library/books/${id}`);
    expect(retry.request.body).toMatchObject({
      title: 'Edited Title',
      shelfId: 'shelf-1',
      sourceBookId: 'source-volume',
    });
    retry.flush({ ...saved, title: 'Edited Title' });
    await harness.fixture.whenStable();
    http.expectOne(`/api/library/books/${id}`).flush({ ...saved, title: 'Edited Title' });
    harness.detectChanges();
  });

  it('preserves the existing shelf assignment and label if shelf options fail to load', async () => {
    await harness.navigateByUrl(url);
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    http.expectOne('/api/shelves').flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    saveButton().click();
    const request = http.expectOne(`/api/library/books/${id}`);
    expect(request.request.body.shelfId).toBe(saved.shelfId);
    expect(request.request.body.shelfLocation).toBe(saved.shelfLocation);
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(url);
  });

  it('prevents saving a missing book', async () => {
    await harness.navigateByUrl(url);
    http.expectOne('/api/shelves').flush(shelves);
    http.expectOne(`/api/library/books/${id}`).flush({}, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('This book could not be found');
    expect(saveButton().disabled).toBe(true);
    saveButton().click();
    http.expectNone((req) => req.method === 'PUT' || req.method === 'POST');
  });

  it('allows retrying a failed initial load without submitting incomplete data', async () => {
    await harness.navigateByUrl(url);
    http.expectOne('/api/shelves').flush(shelves);
    http
      .expectOne(`/api/library/books/${id}`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(saveButton().disabled).toBe(true);
    element().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    http.expectOne(`/api/library/books/${id}`).flush(saved);
    await harness.fixture.whenStable();
    expect(saveButton().disabled).toBe(false);
    expect(element().querySelector<HTMLInputElement>('#title')!.value).toBe(saved.title);
    http.expectNone((req) => req.method === 'PUT' || req.method === 'POST');
  });
});
