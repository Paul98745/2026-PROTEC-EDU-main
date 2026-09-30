import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('restores the saved palette when the application starts', () => {
    localStorage.setItem('protecedu.palette', 'indigo');
    const theme = TestBed.inject(ThemeService);
    expect(theme.selected()).toBe('indigo');
    expect(document.documentElement.getAttribute('data-palette')).toBe('indigo');
  });

  it('applies and persists a selection, rejecting unknown palettes', () => {
    const theme = TestBed.inject(ThemeService);
    theme.select('bosque');
    expect(document.documentElement.getAttribute('data-palette')).toBe('bosque');
    expect(localStorage.getItem('protecedu.palette')).toBe('bosque');
    theme.select('unknown');
    expect(theme.selected()).toBe('bosque');
  });

  it('uses the default when a saved palette is invalid', () => {
    localStorage.setItem('protecedu.palette', 'unknown');
    expect(TestBed.inject(ThemeService).selected()).toBe('institucional');
  });
});
