import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OwnedBookService } from './owned-books/services/owned-book.service';
import { OwnedBook } from './owned-books/models/owned-book';
import { Router } from '@angular/router';
import { routes } from './app.routes';

describe('App shell', () => {
  it('displays the application name, navigation, and main content area', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/library/books').flush([{ id: 'one' }, { id: 'two' }]);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header')?.textContent).toContain('My Library');
    expect(element.querySelector('nav')?.textContent).toContain('Library');
    expect(element.querySelector('nav a[href="/shelves"]')).toBeNull();
    expect(element.querySelector('main')).toBeTruthy();
    expect(element.querySelector('.book-count')?.textContent?.trim()).toBe('2 books');
    expect(element.querySelector('.profile-summary')?.firstElementChild).toBe(
      element.querySelector('.book-count'),
    );
    expect(element.querySelector('.book-count')?.nextElementSibling?.id).toBe('profile-img');
    http.verify();
  });

  it('opens the profile menu with only Manage Shelves and navigates to shelves', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    http.expectOne('/api/library/books').flush([]);
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('#profile-img');
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = document.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
    expect(items.length).toBe(1);
    expect(items[0].textContent?.trim()).toBe('Manage Shelves');
    expect(items[0].getAttribute('href')).toBe('/shelves');
    items[0].click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/shelves');
    http.expectOne('/api/shelves').flush([]);
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    http.verify();
  });

  it('closes the profile menu on Escape or an outside click', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/library/books').flush([]);
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('#profile-img');
    trigger.click();
    await fixture.whenStable();
    document
      .querySelector('[role="menu"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    http.verify();
  });

  it('updates the total after a successful save and uses singular and zero labels', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const library = TestBed.inject(OwnedBookService);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    http.expectOne('/api/library/books').flush([]);
    await fixture.whenStable();
    const count = () => fixture.nativeElement.querySelector('.book-count').textContent.trim();
    expect(count()).toBe('0 books');
    const book = {
      ...new OwnedBook(),
      title: 'New Book',
      sourceBookId: null,
      isRead: false,
      shelfLocation: null,
    };
    library.create(book).subscribe();
    expect(count()).toBe('0 books');
    http.expectOne('/api/library/books').flush({ ...book, id: 'new-book' });
    await fixture.whenStable();
    expect(count()).toBe('1 book');
    library.list().subscribe();
    http.expectOne('/api/library/books').flush([{ id: 'new-book' }]);
    await fixture.whenStable();
    expect(count()).toBe('1 book');
    library.create(book).subscribe({ error: () => {} });
    http.expectOne('/api/library/books').flush({}, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(count()).toBe('1 book');
    http.verify();
  });

  it('does not show a false zero if the total cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/library/books').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.book-count').textContent.trim()).toBe('- books');
    http.verify();
  });
});
