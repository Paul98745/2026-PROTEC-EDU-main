import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { emptyPerson, People } from './people';
import { PersonForm, PeopleService } from './people.service';

describe('People form', () => {
  const person = {
    ...emptyPerson(),
    id: 'person-1',
    firstName: 'Ana',
    lastName: 'Pérez',
    documentNumber: '12345678',
    documents: [],
  };
  const api = {
    list: vi.fn(() => of({ items: [], total: 0, page: 1 })),
    accounts: vi.fn(() => of([])),
    get: vi.fn(() => of(person)),
    save: vi.fn((_id: string | null, input: PersonForm) =>
      of({ ...input, id: 'person-1', documents: [] }),
    ),
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [People],
      providers: [
        provideRouter([]),
        { provide: PeopleService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            user: signal({
              institution: { name: 'Demo' },
              permissions: ['people.view', 'people.create', 'people.edit'],
            }),
          },
        },
      ],
    }).compileComponents();
  });
  it('shows a saved alumno without work document options, and enables them for collaborators', async () => {
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.open('person-1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Los alumnos no necesitan documentos laborales',
    );
    expect(fixture.componentInstance.availableKinds().some((k) => k.value === 'CV')).toBe(false);
    fixture.componentInstance.model.profile = 'COLABORADOR';
    fixture.componentInstance.profileChanged();
    fixture.detectChanges();
    expect(fixture.componentInstance.availableKinds().some((k) => k.value === 'CV')).toBe(true);
  });
  it('submits a valid new person from the rendered form without attachments', async () => {
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.create();
    fixture.detectChanges();
    await fixture.whenStable();
    for (const [name, value] of Object.entries({
      firstName: 'Ana',
      lastName: 'Pérez',
      documentNumber: '12345678',
    })) {
      const input = fixture.nativeElement.querySelector(
        name === 'documentNumber' ? 'input[name="documentNumber"]' : `#${name}`,
      ) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('.editor form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.save).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        firstName: 'Ana',
        lastName: 'Pérez',
        documentNumber: '12345678',
        profile: 'ALUMNO',
        relatives: [],
      }),
    );
    expect(fixture.componentInstance.model.firstName).toBe('Ana');
    expect(fixture.componentInstance.editingId()).toBe('person-1');
    expect(fixture.componentInstance.dirty).toBe(false);
  });
  it('keeps incomplete forms from reaching the API and protects relatives with documents', async () => {
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement
      .querySelector('.editor form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.save).not.toHaveBeenCalled();
    const component = fixture.componentInstance;
    component.model.relatives = [
      {
        id: 'child-1',
        relationship: 'HIJO',
        firstName: 'Luis',
        lastName: 'Pérez',
        gender: '',
        documentNumber: '87654321',
      },
    ];
    component.documents.set([
      {
        id: 'doc-1',
        relativeId: 'child-1',
        kind: 'DOCUMENTO_HIJO',
        originalName: 'dni.pdf',
        mimeType: 'application/pdf',
        size: 20,
        createdAt: '2026-09-22',
      },
    ]);
    component.removeRelative(0);
    expect(component.model.relatives).toHaveLength(1);
    expect(component.error()).toContain('Retira primero');
  });
});
