import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { EditGoalDialog } from './edit-goal-dialog';
import { Goal } from './goal.service';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';

const goal: Goal = {
  id: 'goal-1',
  goalType: 'BookCount',
  num: 25,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  includeNonLibraryBooks: true,
  completedCount: null,
};
const books = [{ isRead: true, dateRead: '2026-03-01' }] as LibraryBookSummary[];

describe('Edit goal dialog', () => {
  let fixture: ComponentFixture<EditGoalDialog>;
  let http: HttpTestingController;
  let dialog: HTMLDialogElement;
  let trigger: HTMLButtonElement;
  let fallback: HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [EditGoalDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditGoalDialog);
    await fixture.whenStable();
    dialog = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
    trigger = document.createElement('button');
    fallback = document.createElement('button');
    document.body.append(trigger, fallback);
    fixture.componentInstance.open(goal, books, trigger, fallback);
    await fixture.whenStable();
  });
  afterEach(() => {
    http.verify();
    trigger.remove();
    fallback.remove();
  });

  async function fill(id: string, value: string) {
    const input = dialog.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }
  async function click(label: string) {
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await fixture.whenStable();
  }

  it('prefills values, fixes the type, saves a manual count and dates, and restores focus', async () => {
    expect(dialog.querySelector('h2')?.textContent).toBe('Edit Books Read');
    expect(dialog.querySelector<HTMLInputElement>('#edit-goal-count')!.value).toBe('1');
    expect(dialog.querySelector<HTMLInputElement>('[name="useCalculated"]')!.checked).toBe(true);
    expect(dialog.querySelector('select, [name="goalType"]')).toBeNull();
    await fill('edit-goal-count', '8');
    await fill('edit-goal-target', '50');
    await fill('edit-goal-start', '2026-02-01');
    await fill('edit-goal-end', '2026-11-30');
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await click('Save changes');
    const request = http.expectOne({ method: 'PUT', url: '/api/goals/goal-1' });
    expect(request.request.body).toEqual({
      goalType: 'BookCount',
      num: 50,
      completedCount: 8,
      startDate: '2026-02-01',
      endDate: '2026-11-30',
      includeNonLibraryBooks: true,
    });
    const response = { id: goal.id, ...request.request.body };
    request.flush(response);
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith(response);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('restores automatic progress by saving a null completed count', async () => {
    fixture.componentInstance.open({ ...goal, completedCount: 9 }, books, trigger, fallback);
    await fixture.whenStable();
    expect(dialog.querySelector<HTMLInputElement>('[name="useCalculated"]')!.checked).toBe(false);
    dialog.querySelector<HTMLInputElement>('[name="useCalculated"]')!.click();
    await fixture.whenStable();
    expect(dialog.querySelector<HTMLInputElement>('#edit-goal-count')!.value).toBe('1');
    await click('Save changes');
    const request = http.expectOne({ method: 'PUT', url: '/api/goals/goal-1' });
    expect(request.request.body.completedCount).toBeNull();
    request.flush({ ...goal, completedCount: null });
  });

  it('validates required fields, dates, and whole-number counts before sending an update', async () => {
    await fill('edit-goal-target', '');
    await click('Save changes');
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Complete all required fields',
    );
    await fill('edit-goal-target', '25');
    await fill('edit-goal-end', '2025-01-01');
    await click('Save changes');
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'End date must be on or after start date',
    );
    await fill('edit-goal-end', '2026-12-31');
    await fill('edit-goal-count', '1.5');
    await click('Save changes');
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('whole numbers');
    http.expectNone((request) => request.method === 'PUT');
  });

  it('keeps edits after failed saves and prevents duplicate submissions', async () => {
    await fill('edit-goal-count', '3');
    await click('Save changes');
    const request = http.expectOne({ method: 'PUT', url: '/api/goals/goal-1' });
    dialog
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectNone({ method: 'PUT', url: '/api/goals/goal-1' });
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    request.flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector<HTMLInputElement>('#edit-goal-count')!.value).toBe('3');
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Your goal could not be saved',
    );
    await click('Save changes');
    http
      .expectOne({ method: 'PUT', url: '/api/goals/goal-1' })
      .flush(
        { errors: { num: ['Invalid goal target.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Invalid goal target.');
  });

  it('confirms deletion, preserves the goal on failure, and closes only after success', async () => {
    const deleted = vi.fn();
    fixture.componentInstance.deleted.subscribe(deleted);
    await click('Delete goal permanently');
    http.expectNone((request) => request.method === 'DELETE');
    await click('Keep goal');
    expect(dialog.textContent).not.toContain('This cannot be undone.');
    await click('Delete goal permanently');
    await click('Permanently delete goal');
    http
      .expectOne({ method: 'DELETE', url: '/api/goals/goal-1' })
      .flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(deleted).not.toHaveBeenCalled();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Your goal could not be deleted',
    );
    await click('Permanently delete goal');
    http
      .expectOne({ method: 'DELETE', url: '/api/goals/goal-1' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(deleted).toHaveBeenCalledWith(goal.id);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(fallback);
  });
});
