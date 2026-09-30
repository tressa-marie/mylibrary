import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Home } from './home';

describe('Home connection status', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('checks health on startup and displays a successful connection', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Checking connection');
    expect(element.querySelector('button')?.disabled).toBe(true);
    const request = http.expectOne('/api/health');
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'Healthy', service: 'My Library API' });
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Connected');
    expect(element.querySelector('button')?.disabled).toBe(false);
  });

  it('shows a connection error and allows a successful retry', () => {
    http.expectOne('/api/health').flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Unable to connect');
    element.querySelector('button')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Checking connection');
    http.expectOne('/api/health').flush({ status: 'Healthy', service: 'My Library API' });
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Connected');
  });

  it('does not report an unhealthy response as connected', () => {
    http.expectOne('/api/health').flush({ status: 'Unhealthy', service: 'My Library API' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to connect');
  });
});
