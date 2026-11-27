import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Goals } from './goals';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { CHART, type ChartConfiguration } from '../shared/charts/chart';

const chartMock = vi.fn(
  class {
    constructor(_canvas: HTMLCanvasElement, _config: ChartConfiguration) {}
    destroy = vi.fn();
  },
);

describe('Goals', () => {
  let fixture: ComponentFixture<Goals>;
  let element: HTMLElement;
  let dialog: HTMLDialogElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Goals],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CHART, useValue: chartMock },
      ],
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

  for (const type of ['BookCount', 'PageCount', 'BuyBookCount', 'ReadBookPercentage']) {
    it(`blocks selecting an existing ${type} goal and permits an available type`, async () => {
      fixture.destroy();
      fixture = TestBed.createComponent(Goals);
      await fixture.whenStable();
      http.expectOne('/api/goals').flush([
        {
          id: 'existing',
          goalType: type,
          num: 20,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          includeNonLibraryBooks: false,
        },
      ]);
      http.expectOne('/api/library/books').flush([]);
      await fixture.whenStable();
      element = fixture.nativeElement;
      dialog = element.querySelector('dialog')!;
      dialog.showModal = () => dialog.setAttribute('open', '');
      await open();
      dialog.querySelector<HTMLInputElement>(`input[value="${type}"]`)!.click();
      await fixture.whenStable();
      expect(dialog.querySelector('#goal-type-error')?.textContent).toContain('You already have a');
      expect(dialog.querySelector('#goal-type-error')?.textContent).toContain('Edit or delete it');
      expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      dialog
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      expect(dialog.querySelector('.count-goal-form')).toBeNull();
      const available = type === 'PageCount' ? 'BookCount' : 'PageCount';
      dialog.querySelector<HTMLInputElement>(`input[value="${available}"]`)!.click();
      await fixture.whenStable();
      expect(dialog.querySelector('#goal-type-error')).toBeNull();
      expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
        false,
      );
    });
  }

  it('shows backend duplicate errors when another session creates the selected type', async () => {
    await open();
    dialog.querySelector<HTMLInputElement>('input[value="BookCount"]')!.click();
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    for (const [id, value] of [
      ['goal-count', '12'],
      ['goal-start-date', '2026-01-01'],
      ['goal-end-date', '2026-12-31'],
    ]) {
      const input = dialog.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    http.expectOne({ method: 'POST', url: '/api/goals' }).flush(
      {
        errors: {
          goalType: [
            'You already have a goal of this type. Edit or delete it before creating another.',
          ],
        },
      },
      { status: 409, statusText: 'Conflict' },
    );
    http
      .expectOne({ method: 'GET', url: '/api/goals' })
      .flush([{ id: 'other-session', goalType: 'BookCount', num: 20 }]);
    http.expectOne('/api/library/books').flush([]);
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'You already have a goal of this type',
    );
    expect(dialog.querySelector<HTMLInputElement>('#goal-count')!.value).toBe('12');
    dialog.querySelector<HTMLButtonElement>('.dialog-actions .secondary-button')!.click();
    await fixture.whenStable();
    expect(dialog.querySelector('#goal-type-error')?.textContent).toContain('You already have a');
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('opens editing from the icon right of the title, updates progress, and removes deleted goals', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Goals);
    await fixture.whenStable();
    const goal = {
      id: 'editable',
      goalType: 'BookCount',
      num: 10,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      includeNonLibraryBooks: false,
      completedCount: null,
    };
    http.expectOne('/api/goals').flush([goal]);
    http.expectOne('/api/library/books').flush([{ isRead: true, dateRead: '2026-03-01' }]);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    const editDialog = page.querySelector<HTMLDialogElement>('app-edit-goal-dialog dialog')!;
    editDialog.showModal = () => editDialog.setAttribute('open', '');
    editDialog.close = () => {
      editDialog.removeAttribute('open');
      editDialog.dispatchEvent(new Event('close'));
    };
    const trigger = page.querySelector<HTMLButtonElement>('.edit-button')!;
    expect(page.querySelector('app-goal-progress-card h2')?.nextElementSibling).toBe(trigger);
    trigger.click();
    await fixture.whenStable();
    expect(editDialog.open).toBe(true);
    const count = editDialog.querySelector<HTMLInputElement>('#edit-goal-count')!;
    count.value = '7';
    count.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    editDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const update = http.expectOne({ method: 'PUT', url: '/api/goals/editable' });
    expect(update.request.body.goalType).toBe('BookCount');
    update.flush({ ...goal, completedCount: 7 });
    await fixture.whenStable();
    expect(page.querySelector('.goal-count')?.textContent).toBe('7/10');
    expect(page.querySelector('.percentage')?.textContent).toBe('70%');
    expect(editDialog.open).toBe(false);
    trigger.click();
    await fixture.whenStable();
    editDialog.querySelector<HTMLButtonElement>('.delete-section > button')!.click();
    await fixture.whenStable();
    editDialog.querySelector<HTMLButtonElement>('.delete-section .danger')!.click();
    http
      .expectOne({ method: 'DELETE', url: '/api/goals/editable' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(page.querySelector('app-goal-progress-card')).toBeNull();
    expect(page.querySelector('.empty-goals h2')?.textContent).toBe('No Goals');
    const createDialog = page.querySelector<HTMLDialogElement>('dialog')!;
    createDialog.showModal = () => createDialog.setAttribute('open', '');
    page.querySelector<HTMLButtonElement>('.page-header button')!.click();
    await fixture.whenStable();
    createDialog.querySelector<HTMLInputElement>('input[value="BookCount"]')!.click();
    await fixture.whenStable();
    expect(createDialog.querySelector('#goal-type-error')).toBeNull();
    expect(createDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      false,
    );
  });

  it('renders the four goal cards with Chart.js progress, counts, and the buying warning', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Goals);
    await fixture.whenStable();
    const types = ['BookCount', 'PageCount', 'ReadBookPercentage', 'BuyBookCount'];
    http.expectOne('/api/goals').flush(
      types.map((goalType, index) => ({
        id: `goal-${index}`,
        goalType,
        num: [5, 500, 80, 3][index],
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        includeNonLibraryBooks: false,
      })),
    );
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-goal-progress-card')).toBeNull();
    http.expectOne('/api/library/books').flush([
      { isRead: true, dateRead: '2026-01-01', pageCount: 100, dateAcquired: '2026-01-01' },
      { isRead: true, dateRead: '2026-01-31', pageCount: 150, dateAcquired: '2026-01-31' },
      { isDnf: true, dateRead: '2026-01-15', pageCount: 200, dateAcquired: '2026-01-15' },
      { isRead: false, dateAcquired: '2025-12-31' },
    ]);
    await fixture.whenStable();
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('app-goal-progress-card'),
    ) as HTMLElement[];
    expect(cards.map((card) => card.querySelector('h2')?.textContent)).toEqual([
      'Books Read',
      'Pages Read',
      'Library Read Percentage',
      'Book Buying Limit',
    ]);
    expect(cards.map((card) => card.querySelector('.goal-count')?.textContent ?? null)).toEqual([
      '2/5',
      '250/500',
      '80%',
      '3/3',
    ]);
    const marker = cards[2].querySelector<HTMLElement>('.goal-marker')!;
    expect(marker.style.left).toBe('80%');
    expect(cards[2].querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '75',
    );
    expect(cards[2].querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe(
      '75% read; goal 80%',
    );
    expect(cards[0].querySelector('.goal-marker')).toBeNull();
    expect(cards.map((card) => card.querySelector('.percentage')?.textContent)).toEqual([
      '40%',
      '50%',
      '75%',
      '100%',
    ]);
    expect(chartMock).toHaveBeenCalledTimes(4);
    const configs = chartMock.mock.calls.map(([, config]) => config);
    expect(configs.map((config) => config.data.datasets[0].data)).toEqual([
      [40],
      [50],
      [75],
      [100],
    ]);
    expect(configs[3].data.datasets[0].backgroundColor).toBe('#a13e29');
    expect(configs[0].options).toMatchObject({
      indexAxis: 'y',
      scales: { x: { min: 0, max: 100, stacked: true } },
    });
    const instances = chartMock.mock.results.map((result) => result.value);
    fixture.destroy();
    for (const instance of instances) expect(instance.destroy).toHaveBeenCalledOnce();
  });

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
    http.expectOne('/api/goals').flush([
      {
        id: 'goal-1',
        goalType: 'BookCount',
        num: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        includeNonLibraryBooks: false,
      },
    ]);
    http.expectOne('/api/library/books').flush([]);
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
      Array.from(dialog.querySelectorAll('.dialog-actions button'), (button) =>
        button.textContent?.trim(),
      ),
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

  for (const type of ['BookCount', 'PageCount', 'BuyBookCount', 'ReadBookPercentage']) {
    it(`requires all three fields on Submit for ${type} and clears errors as they are filled`, async () => {
      await open();
      dialog.querySelector<HTMLInputElement>(`input[value="${type}"]`)!.click();
      await fixture.whenStable();
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      if (type === 'ReadBookPercentage') http.expectOne('/api/library/books').flush([]);
      await fixture.whenStable();
      expect(dialog.querySelectorAll('.field-error').length).toBe(0);
      const submit = dialog.querySelector<HTMLButtonElement>(
        '.count-goal-form button[type="submit"]',
      )!;
      submit.click();
      await fixture.whenStable();
      expect(
        Array.from(dialog.querySelectorAll('.field-error'), (error) => error.textContent?.trim()),
      ).toEqual(['Enter a goal target.', 'Enter a start date.', 'Enter an end date.']);
      expect(document.activeElement?.id).toBe('goal-count');
      for (const [index, [id, value]] of [
        ['goal-count', '0'],
        ['goal-start-date', '2026-12-01'],
        ['goal-end-date', '2026-12-31'],
      ].entries()) {
        const input = dialog.querySelector<HTMLInputElement>(`#${id}`)!;
        expect(input.required).toBe(true);
        input.value = value;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
        expect(dialog.querySelectorAll('.field-error').length).toBe(2 - index);
      }
      submit.click();
      await fixture.whenStable();
      expect(dialog.querySelectorAll('.field-error').length).toBe(0);
      const request = http.expectOne({ method: 'POST', url: '/api/goals' });
      expect(request.request.body).toEqual({
        goalType: type,
        num: 0,
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        includeNonLibraryBooks: false,
      });
      const saved = { id: 'new-goal', ...request.request.body };
      request.flush(saved, { status: 201, statusText: 'Created' });
      http.expectOne({ method: 'GET', url: '/api/goals' }).flush([saved]);
      http.expectOne('/api/library/books').flush([]);
      await fixture.whenStable();
      expect(dialog.open).toBe(false);
      expect(element.textContent).toContain('Your goal was created.');
      expect(element.querySelector('.empty-goals')).toBeNull();
      expect(document.activeElement).toBe(element.querySelector('.page-header button'));
    });
  }

  for (const [type, unit] of [
    ['BookCount', 'books'],
    ['PageCount', 'pages'],
    ['BuyBookCount', 'books'],
  ]) {
    it(`shows the ${unit} goal fields and keeps edits on Back`, async () => {
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

  it('prevents duplicate saves and keeps entries available after server errors for retry', async () => {
    await open();
    dialog.querySelector<HTMLInputElement>('input[value="BookCount"]')!.click();
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    for (const [id, value] of [
      ['goal-count', '12'],
      ['goal-start-date', '2026-12-01'],
      ['goal-end-date', '2026-12-31'],
    ]) {
      const input = dialog.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    const form = dialog.querySelector<HTMLFormElement>('.count-goal-form')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.click();
    const pending = http.expectOne({ method: 'POST', url: '/api/goals' });
    await fixture.whenStable();
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Saving');
    expect(form.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectNone({ method: 'POST', url: '/api/goals' });
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    pending.flush(
      { errors: { endDate: ['Please choose another end date.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Please choose another end date.',
    );
    expect(dialog.querySelector<HTMLInputElement>('#goal-count')!.value).toBe('12');
    expect(dialog.querySelector<HTMLInputElement>('#goal-start-date')!.value).toBe('2026-12-01');
    expect(dialog.querySelector<HTMLInputElement>('#goal-end-date')!.value).toBe('2026-12-31');
    expect(submit.disabled).toBe(false);
    submit.click();
    http
      .expectOne({ method: 'POST', url: '/api/goals' })
      .flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Your goal could not be saved.',
    );
    expect(dialog.querySelector('[role="alert"]')?.textContent).not.toContain(
      'Please choose another end date.',
    );
    submit.click();
    const retry = http.expectOne({ method: 'POST', url: '/api/goals' });
    expect(retry.request.body).toEqual(pending.request.body);
    const saved = { id: 'saved-goal', ...retry.request.body };
    retry.flush(saved, { status: 201, statusText: 'Created' });
    http.expectOne({ method: 'GET', url: '/api/goals' }).flush([saved]);
    http.expectOne('/api/library/books').flush([]);
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });
});
