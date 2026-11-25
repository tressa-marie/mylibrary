import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';

describe('Saved library book details', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const id = 'd81fbd37-49a8-47b9-beff-77223da6c40b';
  const saved = {
    id,
    sourceBookId: 'google-volume-id',
    title: 'My saved title',
    author: 'Saved Author',
    genre: 'Fantasy',
    shelfLocation: 'Office, shelf 2',
    isRead: true,
    rating: 4.5,
    isbn: '9781784702861',
    format: 'Paperback',
    publisher: 'Saved Publisher',
    publicationYear: 2020,
    edition: 'First edition',
    pageCount: 240,
    authorGender: null,
    purchaseLocation: 'Local bookshop',
    description: 'My saved description',
    coverUrl: null,
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify());

  it('opens a saved book by clicking a table row and loads its library ID', async () => {
    await harness.navigateByUrl('/');
    http.expectOne('/api/library/books').flush([saved]);
    harness.detectChanges();
    const row = harness.routeNativeElement!.querySelector('tbody tr')!;
    expect(row.querySelector('a')?.getAttribute('href')).toBe(`/library/books/${id}`);
    row.querySelector<HTMLElement>('td')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/library/books/${id}`);
    expect(harness.routeNativeElement!.textContent).toContain('Loading book details');
    const request = http.expectOne(`/api/library/books/${id}`);
    expect(request.request.method).toBe('GET');
    http.expectNone('/api/books/google-volume-id');
    request.flush(saved);
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')?.textContent).toBe(saved.title);
    for (const value of [
      'Saved Author',
      'Fantasy',
      'Office, shelf 2',
      '4.5',
      'Saved Publisher',
      'First edition',
      'Local bookshop',
      'My saved description',
    ]) {
      expect(element.textContent).toContain(value);
    }
    const rating = Array.from(element.querySelectorAll('dl div')).find(
      (div) => div.querySelector('dt')?.textContent === 'Rating',
    );
    expect(rating?.querySelector('dd')?.textContent).toBe('4.5');
    expect(element.querySelector('.back-link')?.getAttribute('href')).toBe('/');
  });

  it('supports direct links, dashes for absent values, and a broken cover fallback', async () => {
    await harness.navigateByUrl(`/library/books/${id}`);
    http.expectOne(`/api/library/books/${id}`).flush({
      ...saved,
      genre: null,
      shelfLocation: null,
      isRead: false,
      rating: 4,
      coverUrl: '/api/books/google-volume-id/cover',
    });
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    for (const label of ['Genre', 'Shelf location', 'Rating', 'Author gender']) {
      const field = Array.from(element.querySelectorAll('dl div')).find(
        (div) => div.querySelector('dt')?.textContent === label,
      );
      expect(field?.querySelector('dd')?.textContent).toBe('-');
    }
    element.querySelector('img')!.dispatchEvent(new Event('error'));
    harness.detectChanges();
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('No cover available');
  });

  it('shows a missing-book message for 404 responses', async () => {
    await harness.navigateByUrl(`/library/books/${id}`);
    http.expectOne(`/api/library/books/${id}`).flush({}, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain(
      'Book not found',
    );
    expect(harness.routeNativeElement!.querySelector('dl')).toBeNull();
  });

  it('retries a failed load and cancels stale requests when the route ID changes', async () => {
    await harness.navigateByUrl(`/library/books/${id}`);
    http
      .expectOne(`/api/library/books/${id}`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Could not load book details');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    harness.detectChanges();
    const retry = http.expectOne(`/api/library/books/${id}`);
    const otherId = 'c81fbd37-49a8-47b9-beff-77223da6c40b';
    await harness.navigateByUrl(`/library/books/${otherId}`);
    expect(retry.cancelled).toBe(true);
    http
      .expectOne(`/api/library/books/${otherId}`)
      .flush({ ...saved, id: otherId, title: 'Another saved book' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe('Another saved book');
  });
});
