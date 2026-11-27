import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Goals } from './goals';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('Goals', () => {
  let fixture: ComponentFixture<Goals>;
  let element: HTMLElement;
  let dialog: HTMLDialogElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Goals],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Goals);
    await fixture.whenStable();
    http.expectOne('/api/goals').flush([]);
    await fixture.whenStable();
    element = fixture.nativeElement;
    dialog = element.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
  });
  afterEach(() => http.verify());

  it('explains how to create goals when the saved goals list is empty', () => {
    expect(element.querySelector('.empty-goals h2')?.textContent).toBe('No Goals');
    expect(element.querySelector('.empty-goals')?.textContent).toContain('Create New Goal');
    expect(element.querySelector('.empty-goals')?.textContent).toContain(
      'Your goals will appear here.',
    );
  });

  it('does not show No Goals while loading or when saved goals exist', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Goals);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('.empty-goals')).toBeNull();
    http
      .expectOne('/api/goals')
      .flush([
        {
          id: 'goal-1',
          goalType: 'BookCount',
          num: 12,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          includeNonLibraryBooks: false,
        },
      ]);
    await fixture.whenStable();
    expect(page.querySelector('.empty-goals')).toBeNull();
  });

  it('shows a retry instead of No Goals if fetching goals fails', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Goals);
    await fixture.whenStable();
    http.expectOne('/api/goals').flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('.empty-goals')).toBeNull();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Could not load goals');
    page.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    http.expectOne('/api/goals').flush([]);
    await fixture.whenStable();
    expect(page.querySelector('.empty-goals h2')?.textContent).toBe('No Goals');
  });

  async function open() {
    element.querySelector<HTMLButtonElement>('.page-header button')!.click();
    await fixture.whenStable();
  }

  async function openPercentageGoal() {
    await open();
    dialog.querySelector<HTMLInputElement>('input[value="ReadBookPercentage"]')!.click();
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }

  for (const { books, expected } of [
    {
      books: [
        { isRead: true },
        { isRead: true, isDnf: true },
        { isRead: false, isDnf: true },
        { isRead: false },
      ],
      expected: '75%',
    },
    { books: [{ isRead: true }, { isDnf: true }, { isRead: false }], expected: '66.7%' },
    { books: [{ isRead: false }, { isRead: false }], expected: '0%' },
    { books: [{ isRead: true }, { isDnf: true }], expected: '100%' },
    { books: [], expected: '0%' },
  ]) {
    it(`calculates ${expected} for ${JSON.stringify(books)} counting DNF as read`, async () => {
      await openPercentageGoal();
      expect(dialog.querySelector('.current-read-percentage')?.textContent).toContain(
        'Loading current read percentage',
      );
      http.expectOne('/api/library/books').flush(books);
      await fixture.whenStable();
      expect(dialog.querySelector('.current-read-percentage')?.textContent).toContain(
        `Current read percentage is ${expected}`,
      );
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Set Your Goal');
      expect(dialog.querySelector('.percentage-target label')?.textContent?.trim()).toBe(
        'I want my library read',
      );
      expect(dialog.querySelector('.percentage-target')?.textContent).toContain(
        'percentage to be at',
      );
      expect(dialog.querySelector<HTMLInputElement>('#goal-count')!.max).toBe('100');
      expect(
        dialog.querySelector<HTMLInputElement>('#goal-count')!.getAttribute('aria-label'),
      ).toBe('Percentage of library read');
      expect(dialog.querySelectorAll('input[type="date"]').length).toBe(2);
      const buttons = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('.dialog-actions button'),
      );
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Back', 'Submit']);
      buttons[1].click();
      await fixture.whenStable();
      expect(dialog.open).toBe(true);
      buttons[0].click();
      await fixture.whenStable();
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Select A Goal Type');
    });
  }

  it('shows a loading failure without a false percentage and supports retry', async () => {
    await openPercentageGoal();
    http.expectOne('/api/library/books').flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(dialog.querySelector('.current-read-percentage')?.textContent).toContain(
      'Could not load current read percentage',
    );
    expect(dialog.querySelector('.current-read-percentage')?.textContent).not.toContain('0%');
    dialog.querySelector<HTMLButtonElement>('.current-read-percentage button')!.click();
    http.expectOne('/api/library/books').flush([{ isRead: true }, { isRead: false }]);
    await fixture.whenStable();
    expect(dialog.querySelector('.current-read-percentage')?.textContent).toContain(
      'Current read percentage is 50%',
    );
  });

  it('shows the wireframe choices in order and only advances after a selection', async () => {
    await open();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Select A Goal Type');
    expect(Array.from(dialog.querySelectorAll('.goal-name'), (name) => name.textContent)).toEqual([
      'Page Count',
      'Book Count',
      'Buying Books',
      'Read My Library',
    ]);
    expect(
      Array.from(
        dialog.querySelectorAll('.goal-description'),
        (description) => description.textContent,
      ),
    ).toEqual([
      'Commit to reading a set number of pages',
      'Commit to reading a set number of books',
      'Limit the number of books you buy',
      'Commit to reading a percentage of your library',
    ]);
    expect(
      Array.from(dialog.querySelectorAll('.dialog-actions button'), (button) => button.textContent),
    ).toEqual(['Cancel', 'Next']);
    const next = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(next.disabled).toBe(true);
    dialog.querySelector<HTMLInputElement>('input[value="PageCount"]')!.click();
    await fixture.whenStable();
    expect(next.disabled).toBe(false);
    next.click();
    await fixture.whenStable();
    expect(dialog.querySelector('.goal-types')).toBeNull();
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Set Your Goal');
    expect(dialog.querySelector('.count-goal-form')).toBeTruthy();
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Back')!
      .click();
    await fixture.whenStable();
    expect(dialog.querySelector<HTMLInputElement>('input[value="PageCount"]')!.checked).toBe(true);
  });

  it('cancels, restores focus, and resets the selection when reopened', async () => {
    await open();
    dialog.querySelector<HTMLInputElement>('input[value="BookCount"]')!.click();
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('.secondary-button')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element.querySelector('.page-header button'));
    await open();
    expect(dialog.querySelector('input:checked')).toBeNull();
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  for (const [type, unit] of [
    ['BookCount', 'books'],
    ['PageCount', 'pages'],
    ['BuyBookCount', 'books'],
  ]) {
    it(`shows the ${unit} goal fields, keeps edits on Back, and leaves Submit inactive`, async () => {
      await open();
      dialog.querySelector<HTMLInputElement>(`input[value="${type}"]`)!.click();
      await fixture.whenStable();
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
      expect(dialog.querySelector('.reading-target')?.textContent).toContain(unit);
      expect(dialog.querySelector('.reading-target label')?.textContent?.trim()).toBe(
        type === 'BuyBookCount' ? 'I want to buy less' : 'I want to read',
      );
      if (type === 'BuyBookCount') {
        expect(dialog.querySelector('.buying-target > span')?.textContent?.trim()).toBe('than');
      }
      expect(
        Array.from(dialog.querySelectorAll('.date-field label'), (label) => label.textContent),
      ).toEqual(['Start Date', 'End Date']);
      for (const [id, value] of [
        ['goal-count', '24'],
        ['goal-start-date', '2026-12-01'],
        ['goal-end-date', '2026-12-31'],
      ]) {
        const input = dialog.querySelector<HTMLInputElement>(`#${id}`)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      await fixture.whenStable();
      const buttons = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('.dialog-actions button'),
      );
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Back', 'Submit']);
      buttons[1].click();
      await fixture.whenStable();
      expect(dialog.open).toBe(true);
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Set Your Goal');
      buttons[0].click();
      await fixture.whenStable();
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Select A Goal Type');
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
      expect(dialog.querySelector<HTMLInputElement>('#goal-count')!.value).toBe('24');
      expect(dialog.querySelector<HTMLInputElement>('#goal-start-date')!.value).toBe('2026-12-01');
      expect(dialog.querySelector<HTMLInputElement>('#goal-end-date')!.value).toBe('2026-12-31');
    });
  }
});
