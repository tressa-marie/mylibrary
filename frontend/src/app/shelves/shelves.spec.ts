import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Shelves } from './shelves';

describe('Shelves', () => {
  let fixture: ComponentFixture<Shelves>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let dialog: HTMLDialogElement;
  const saved = {
    id: 'shelf-1',
    name: 'Favorites',
    room: 'Study',
    description: 'Books to reread',
    bookIds: [],
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Shelves],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Shelves);
    await fixture.whenStable();
    element = fixture.nativeElement;
    dialog = element.querySelector('dialog')!;
    // jsdom does not implement native modal-dialog behavior.
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
  });
  afterEach(() => http.verify());

  async function open() {
    element.querySelector<HTMLButtonElement>('.page-header button')!.click();
    await fixture.whenStable();
  }
  async function fill(name = ' Favorites ', room = ' Study ', description = ' Books to reread ') {
    for (const [id, value] of [
      ['shelf-name', name],
      ['shelf-room', room],
      ['shelf-description', description],
    ]) {
      const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }
  function save() {
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  it('loads existing shelves and displays missing fields as dashes', async () => {
    expect(element.textContent).toContain('Loading shelves');
    http
      .expectOne('/api/shelves')
      .flush([{ ...saved, room: null, description: null, bookIds: ['book-1'] }]);
    await fixture.whenStable();
    const row = element.querySelector('tbody tr')!;
    expect(Array.from(row.children, (cell) => cell.textContent?.trim())).toEqual([
      'Favorites',
      '-',
      '-',
      '1',
    ]);
  });

  it('opens the modal, closes with X, restores focus, and resets the next form', async () => {
    http.expectOne('/api/shelves').flush([]);
    await fixture.whenStable();
    expect(element.textContent).toContain('No shelves yet');
    expect(dialog.open).toBe(false);
    await open();
    expect(dialog.open).toBe(true);
    await fill();
    dialog.querySelector<HTMLButtonElement>('.close-button')!.click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element.querySelector('.page-header button'));
    await open();
    expect(element.querySelector<HTMLInputElement>('#shelf-name')!.value).toBe('');
    http.expectNone((request) => request.method === 'POST');
  });

  it('submits once, keeps the popup open until success, then closes and refreshes shelves', async () => {
    http.expectOne('/api/shelves').flush([]);
    await open();
    await fill();
    save();
    save();
    const request = http.expectOne('/api/shelves');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Favorites',
      room: 'Study',
      description: 'Books to reread',
      bookIds: [],
    });
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    request.flush(saved);
    http.expectOne('/api/shelves').flush([saved]);
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(element.querySelector('tbody')!.textContent).toContain('Favorites');
    expect(element.textContent).toContain('Favorites was created.');
  });

  it('rejects a whitespace name without posting', async () => {
    http.expectOne('/api/shelves').flush([]);
    await open();
    await fill('   ');
    save();
    await fixture.whenStable();
    http.expectNone((request) => request.method === 'POST');
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')!.textContent).toContain('Enter a shelf name');
  });

  it('preserves fields after validation failure and closes only after a successful retry', async () => {
    http.expectOne('/api/shelves').flush([]);
    await open();
    await fill();
    save();
    http
      .expectOne('/api/shelves')
      .flush(
        { errors: { name: ['Choose another shelf name.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector<HTMLInputElement>('#shelf-name')!.value).toBe(' Favorites ');
    expect(dialog.querySelector('[role="alert"]')!.textContent).toContain(
      'Choose another shelf name.',
    );
    save();
    http.expectOne('/api/shelves').flush(saved);
    http.expectOne('/api/shelves').flush([saved]);
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });

  it('keeps the popup open when the API cannot be reached', async () => {
    http.expectOne('/api/shelves').flush([]);
    await open();
    await fill('Favorites', '', '');
    save();
    const request = http.expectOne('/api/shelves');
    expect(request.request.body.room).toBeNull();
    expect(request.request.body.description).toBeNull();
    request.error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')!.textContent).toContain(
      'Your shelf could not be saved',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('retries loading after a list failure', async () => {
    http.expectOne('/api/shelves').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    http.expectOne('/api/shelves').flush([saved]);
    await fixture.whenStable();
    expect(element.querySelector('tbody')!.textContent).toContain('Favorites');
    expect(element.querySelector('section [role="alert"]')).toBeNull();
  });
});
