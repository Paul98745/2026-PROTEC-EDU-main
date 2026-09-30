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
    ubigeo: vi.fn(() =>
      of({
        departamentos: [
          {
            codigo: '01',
            nombre: 'Amazonas',
            provincias: [
              {
                codigo: '0101',
                nombre: 'Chachapoyas',
                distritos: [
                  { codigo: '010101', nombre: 'Chachapoyas' },
                  { codigo: '010102', nombre: 'Asunción' },
                ],
              },
              {
                codigo: '0102',
                nombre: 'Bagua',
                distritos: [{ codigo: '010201', nombre: 'Bagua' }],
              },
            ],
          },
          {
            codigo: '15',
            nombre: 'Lima',
            provincias: [
              { codigo: '1501', nombre: 'Lima', distritos: [{ codigo: '150101', nombre: 'Lima' }] },
            ],
          },
        ],
      }),
    ),
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
    const gender = fixture.nativeElement.querySelector('#gender') as HTMLSelectElement;
    gender.value = 'Femenino';
    gender.dispatchEvent(new Event('change', { bubbles: true }));
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
  it('offers the requested options and clears descendants when location parents change', async () => {
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.create();
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(element.querySelectorAll('#gender option')).map((o) => o.textContent?.trim()),
    ).toEqual(['Seleccionar', 'Masculino', 'Femenino']);
    expect(element.querySelectorAll('#maritalStatus option')).toHaveLength(5);
    const change = async (name: string, value: string) => {
      const select = element.querySelector(`select[name="${name}"]`) as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    await change('departmentCode', '01');
    expect(element.querySelectorAll('[name="provinceCode"] option')).toHaveLength(3);
    await change('provinceCode', '0101');
    await change('ubigeo', '010102');
    expect(fixture.componentInstance.model).toMatchObject({
      department: 'Amazonas',
      province: 'Chachapoyas',
      district: 'Asunción',
      ubigeo: '010102',
    });
    await change('provinceCode', '0102');
    expect(fixture.componentInstance.model.ubigeo).toBe('');
    expect(fixture.componentInstance.model.district).toBe('');
    await change('ubigeo', '010201');
    await change('departmentCode', '15');
    expect(fixture.componentInstance.provinceCode).toBe('');
    expect(fixture.componentInstance.model.ubigeo).toBe('');
    expect(fixture.componentInstance.model.province).toBe('');
  });
  it('requires gender, fixes Peru and submits the reference without a city control', async () => {
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.create();
    fixture.componentInstance.model.firstName = 'Ana';
    fixture.componentInstance.model.lastName = 'Pérez';
    fixture.componentInstance.model.documentNumber = '12345678';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector('.editor form') as HTMLFormElement;
    const country = element.querySelector('input[name="country"]') as HTMLInputElement;
    expect(country.readOnly).toBe(true);
    expect(country.value).toBe('Perú');
    expect(element.querySelector('[name="city"]')).toBeNull();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.save).not.toHaveBeenCalled();
    const gender = element.querySelector('#gender') as HTMLSelectElement;
    expect(gender.required).toBe(true);
    gender.value = 'Masculino';
    gender.dispatchEvent(new Event('change', { bubbles: true }));
    const reference = element.querySelector('[name="reference"]') as HTMLInputElement;
    reference.value = 'Frente al parque';
    reference.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.save).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        gender: 'Masculino',
        reference: 'Frente al parque',
        country: 'Perú',
      }),
    );
  });
  it('restores a saved UBIGEO on edit and blocks an incomplete new location', async () => {
    api.get.mockReturnValueOnce(
      of({
        ...person,
        country: 'Perú',
        department: 'Amazonas',
        province: 'Chachapoyas',
        district: 'Asunción',
        ubigeo: '010102',
        gender: 'Femenino',
        maritalStatus: 'Soltera',
      }),
    );
    const fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    fixture.componentInstance.open('person-1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[name="ubigeo"]').value).toBe('010102');
    expect(fixture.nativeElement.querySelector('#gender').value).toBe('Femenino');
    expect(fixture.nativeElement.querySelector('#maritalStatus').value).toBe('Soltero/a');
    fixture.componentInstance.departmentCode = '15';
    fixture.componentInstance.departmentChanged();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement
      .querySelector('.editor form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.save).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('Completa departamento');
  });
});
