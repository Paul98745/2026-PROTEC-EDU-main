import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  const user = signal({
    studentCode: 'TEST',
    institution: { code: 'DEMO', name: 'Demo' },
    permissions: [] as string[],
    isSuperAdministrator: false,
  });

  beforeEach(() => {
    localStorage.clear();
    user.update((value) => ({ ...value, permissions: [], isSuperAdministrator: false }));
    TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([]), { provide: AuthService, useValue: { user } }],
    });
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('shows the saved palette in the selector on first render', async () => {
    localStorage.setItem('protecedu.palette', 'bosque');
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select').value).toBe('bosque');
  });

  it('only displays sections permitted for the current user', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    await fixture.whenStable();
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.textContent).not.toContain('Administrar usuarios');
    expect(nav.textContent).not.toContain('Gestionar personas');
    user.update((value) => ({ ...value, permissions: ['users.view', 'people.view'] }));
    fixture.detectChanges();
    expect(nav.textContent).toContain('Administrar usuarios');
    expect(nav.textContent).toContain('Gestionar personas y documentos');
  });
});
