import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ComingSoon } from './coming-soon';
import { routes } from '../../../app.routes';

describe('Coming Soon', () => {
  it('renders the default route with helper text and a link to the library', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/coming-soon');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')?.textContent).toBe('Coming Soon');
    expect(element.querySelector('.helper-text')?.textContent).toContain(
      'This feature is on its way',
    );
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('supports route-specific text and component input overrides', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'future-feature',
            component: ComingSoon,
            data: {
              comingSoonTitle: 'Reading goals',
              comingSoonMessage: 'Your reading goals will live here.',
            },
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/future-feature');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe('Reading goals');
    expect(harness.routeNativeElement!.querySelector('.helper-text')?.textContent).toBe(
      'Your reading goals will live here.',
    );
    const fixture = TestBed.createComponent(ComingSoon);
    fixture.componentRef.setInput('title', 'More coming soon');
    fixture.componentRef.setInput('message', 'We are preparing this feature.');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('More coming soon');
    expect(fixture.nativeElement.querySelector('.helper-text').textContent).toBe(
      'We are preparing this feature.',
    );
  });
});
