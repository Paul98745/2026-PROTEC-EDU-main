import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export const palettes = [
  { id: 'institucional', name: 'Institucional' },
  { id: 'oceano', name: 'Océano' },
  { id: 'indigo', name: 'Índigo' },
  { id: 'bosque', name: 'Bosque' },
  { id: 'terracota', name: 'Terracota' },
] as const;

export type PaletteId = (typeof palettes)[number]['id'];
const storageKey = 'protecedu.palette';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly palettes = palettes;
  readonly selected = signal<PaletteId>('institucional');
  private readonly document = inject(DOCUMENT);

  constructor() {
    let saved: string | null = null;
    try {
      saved = this.document.defaultView?.localStorage.getItem(storageKey) ?? null;
    } catch {
      // The selected palette still works when browser storage is unavailable.
    }
    this.apply(this.isPalette(saved) ? saved : 'institucional');
  }

  select(value: string) {
    if (!this.isPalette(value)) return;
    this.apply(value);
    try {
      this.document.defaultView?.localStorage.setItem(storageKey, value);
    } catch {
      // Keep the palette active for this session if persistence is blocked.
    }
  }

  private apply(value: PaletteId) {
    this.selected.set(value);
    this.document.documentElement.setAttribute('data-palette', value);
  }

  private isPalette(value: string | null): value is PaletteId {
    return palettes.some((palette) => palette.id === value);
  }
}
