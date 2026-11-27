import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { MarkReadDialog } from './mark-read-dialog';
import { LibraryBookSummary } from '../../models/owned-book-api';

const book: LibraryBookSummary = {
  id: 'book-1',
  title: 'Unread book',
  isRead: false,
  rating: null,
  genres: [],
  author: '',
  shelfId: null,
  shelfLocation: null,
  authorGender: null,
  pageCount: null,
};

describe('Mark read dialog', () => {
  let fixture: ComponentFixture<MarkReadDialog>;
  let http: HttpTestingController;
  let dialog: HTMLDialogElement;
  let trigger: HTMLButtonElement;
  let fallback: HTMLDivElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 27, 23, 30));
    TestBed.configureTestingModule({
      imports: [MarkReadDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MarkReadDialog);
    await fixture.whenStable();
    dialog = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
    trigger = document.createElement('button');
    fallback = document.createElement('div');
    fallback.tabIndex = 0;
    document.body.append(trigger, fallback);
    fixture.componentInstance.open(book, trigger, fallback);
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
    trigger.remove();
    fallback.remove();
  });

  async function click(label: string) {
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await fixture.whenStable();
  }
  async function rate(value: string) {
    const input = dialog.querySelector<HTMLInputElement>('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('cancels without updating and clears drafts and validation when reopened', async () => {
    await click('Submit');
    expect(dialog.querySelector('#read-rating-error')?.textContent).toContain(
      'Enter a rating from 0 to 5',
    );
    await rate('4');
    await click('Cancel');
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    http.expectNone((request) => request.method === 'PATCH');
    fixture.componentInstance.open(book, trigger, fallback);
    await fixture.whenStable();
    expect(dialog.querySelector<HTMLInputElement>('input')!.value).toBe('');
    expect(dialog.querySelector('#read-rating-error')).toBeNull();
  });

  it('skips rating validation and omits the rating even if the draft changed', async () => {
    fixture.componentInstance.open({ ...book, rating: 4.5 }, trigger, fallback);
    await fixture.whenStable();
    await rate('9');
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await click('Skip');
    const request = http.expectOne({ method: 'PATCH', url: '/api/library/books/book-1/read' });
    expect(request.request.body).toEqual({ dateRead: '2026-11-27' });
    const result = { ...book, isRead: true, rating: 4.5 };
    request.flush(result);
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith(result);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(fallback);
  });

  for (const rating of [0, 3.75, 5]) {
    it(`submits the rating ${rating} and marks the book read`, async () => {
      await rate(String(rating));
      await click('Submit');
      const request = http.expectOne({ method: 'PATCH', url: '/api/library/books/book-1/read' });
      expect(request.request.body).toEqual({ rating, dateRead: '2026-11-27' });
      request.flush({ ...book, isRead: true, rating });
      await fixture.whenStable();
      expect(dialog.open).toBe(false);
    });
  }

  it('rejects missing and out-of-range ratings without sending requests', async () => {
    for (const value of ['', '-1', '6']) {
      await rate(value);
      await click('Submit');
      expect(dialog.querySelector('#read-rating-error')).not.toBeNull();
      expect(dialog.open).toBe(true);
    }
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('blocks duplicate submissions and dismissal while saving, then preserves input on failure for retry', async () => {
    await rate('2.5');
    await click('Submit');
    const request = http.expectOne({ method: 'PATCH', url: '/api/library/books/book-1/read' });
    dialog
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectNone((request) => request.method === 'PATCH');
    expect(
      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    request.flush(
      { errors: { rating: ['Invalid rating.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector<HTMLInputElement>('input')!.value).toBe('2.5');
    expect(dialog.textContent).toContain('Invalid rating.');
    await click('Submit');
    http
      .expectOne({ method: 'PATCH', url: '/api/library/books/book-1/read' })
      .flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(dialog.textContent).toContain('Your book could not be updated');
    expect(dialog.textContent).not.toContain('Invalid rating.');
    await click('Submit');
    http
      .expectOne({ method: 'PATCH', url: '/api/library/books/book-1/read' })
      .flush({ ...book, isRead: true, rating: 2.5 });
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });
});
