import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App shell', () => {
  it('displays the application name, navigation, and main content area', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header')?.textContent).toContain('My Library');
    expect(element.querySelector('nav')?.textContent).toContain('Home');
    expect(element.querySelector('main')).toBeTruthy();
  });
});
