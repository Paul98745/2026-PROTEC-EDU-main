import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  Account,
  documentKinds,
  fields,
  Person,
  PersonDocument,
  PersonForm,
  PersonSummary,
  PeopleService,
} from './people.service';

export function emptyPerson(): PersonForm {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    secondLastName: '',
    gender: '',
    maritalStatus: '',
    personalEmail: '',
    institutionalEmail: '',
    phone: '',
    referencePhone: '',
    country: '',
    city: '',
    district: '',
    address: '',
    profile: 'ALUMNO',
    status: 'ACTIVO',
    activatedAt: localDate.toISOString().slice(0, 10),
    documentType: 'DNI',
    documentNumber: '',
    membershipId: '',
    relatives: [],
  };
}
@Component({
  selector: 'app-people',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class People implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(PeopleService);
  readonly fields = fields;
  readonly items = signal<PersonSummary[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly documents = signal<PersonDocument[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  search = '';
  model = emptyPerson();
  dirty = false;
  kind = 'IDENTIDAD_ANVERSO';
  relativeId = '';
  file: File | null = null;
  pendingDelete = '';
  private listRequest = 0;
  can(action: string) {
    return (
      !!this.auth.user()?.isSuperAdministrator ||
      !!this.auth.user()?.permissions.includes(`people.${action}`)
    );
  }
  editable() {
    return this.editingId() ? this.can('edit') : this.can('create');
  }
  ngOnInit() {
    this.reload();
    if (this.can('edit'))
      this.api
        .accounts()
        .subscribe({ next: (rows) => this.accounts.set(rows), error: (e) => this.fail(e) });
  }
  reload(page = 1) {
    const request = ++this.listRequest;
    this.loading.set(true);
    this.api.list(this.search, page).subscribe({
      next: (result) => {
        if (request === this.listRequest) {
          this.items.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page);
          this.loading.set(false);
        }
      },
      error: (e) => {
        if (request === this.listRequest) {
          this.loading.set(false);
          this.fail(e);
        }
      },
    });
  }
  create() {
    this.model = emptyPerson();
    this.editingId.set(null);
    this.documents.set([]);
    this.showForm.set(true);
    this.resetState();
  }
  open(id: string) {
    this.busy.set(true);
    this.error.set('');
    this.api
      .get(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({ next: (p) => this.loadPerson(p), error: (e) => this.fail(e) });
  }
  private loadPerson(person: Person) {
    const model = emptyPerson();
    for (const field of fields) model[field.key] = person[field.key] ?? '';
    Object.assign(model, {
      profile: person.profile,
      status: person.status,
      activatedAt: person.activatedAt.slice(0, 10),
      documentType: person.documentType,
      documentNumber: person.documentNumber,
      membershipId: person.membershipId ?? '',
      relatives: person.relatives.map((r) => ({
        id: r.id,
        relationship: r.relationship,
        firstName: r.firstName,
        lastName: r.lastName,
        gender: r.gender ?? '',
        documentNumber: r.documentNumber,
      })),
    });
    this.model = model;
    this.editingId.set(person.id);
    this.documents.set(person.documents);
    this.showForm.set(true);
    this.resetState();
  }
  private resetState() {
    this.dirty = false;
    this.file = null;
    this.relativeId = '';
    this.kind = 'IDENTIDAD_ANVERSO';
    this.pendingDelete = '';
    this.error.set('');
    this.message.set('');
  }
  close() {
    this.showForm.set(false);
    this.resetState();
  }
  profileChanged() {
    this.kind = 'IDENTIDAD_ANVERSO';
    this.relativeId = '';
    this.file = null;
    this.dirty = true;
  }
  documentPattern() {
    return (
      {
        DNI: '[0-9]{8}',
        RUC: '[0-9]{11}',
        CE: '[A-Za-z0-9]{9,12}',
        PASAPORTE: '[A-Za-z0-9]{6,20}',
      }[this.model.documentType] ?? ''
    );
  }
  documentMax() {
    return { DNI: 8, RUC: 11, CE: 12, PASAPORTE: 20 }[this.model.documentType] ?? 20;
  }
  documentInput(value: string) {
    this.model.documentNumber = value
      .replace(
        this.model.documentType === 'DNI' || this.model.documentType === 'RUC'
          ? /[^0-9]/g
          : /[^a-zA-Z0-9]/g,
        '',
      )
      .toUpperCase()
      .slice(0, this.documentMax());
  }
  addRelative(relationship: string) {
    this.model.relatives.push({
      relationship,
      firstName: '',
      lastName: '',
      gender: '',
      documentNumber: '',
    });
    this.dirty = true;
  }
  hasParent(relationship: string) {
    return this.model.relatives.some((r) => r.relationship === relationship);
  }
  removeRelative(index: number) {
    if (
      this.documents().some((d) => d.relativeId && d.relativeId === this.model.relatives[index].id)
    ) {
      this.error.set('Retira primero el documento adjunto de este familiar.');
      return;
    }
    this.model.relatives.splice(index, 1);
    this.dirty = true;
  }
  save(form: NgForm) {
    if (form.invalid || this.busy()) {
      form.control.markAllAsTouched();
      this.error.set(
        'Completa los campos obligatorios y revisa el formato de correos y documentos.',
      );
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .save(this.editingId(), this.model)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (person) => {
          this.loadPerson(person);
          form.control.markAsPristine();
          form.control.markAsUntouched();
          this.message.set('Ficha guardada. Ya puedes adjuntar sus documentos.');
          this.reload(this.page());
        },
        error: (e) => this.fail(e),
      });
  }
  availableKinds() {
    return documentKinds.filter(
      (k) =>
        !(this.model.profile === 'ALUMNO' && k.work) &&
        (k.value !== 'DOCUMENTO_HIJO' || this.children().length),
    );
  }
  children() {
    return this.model.relatives.filter((r) => r.relationship === 'HIJO' && r.id);
  }
  label(kind: string) {
    return documentKinds.find((k) => k.value === kind)?.label ?? kind;
  }
  relativeName(id: string | null) {
    const r = this.model.relatives.find((r) => r.id === id);
    return r ? `${r.firstName} ${r.lastName}` : '';
  }
  selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.error.set('');
    if (
      this.file &&
      (this.file.size > 5 * 1024 * 1024 ||
        !/\.(png|jpe?g|pdf)$/i.test(this.file.name) ||
        !['image/png', 'image/jpeg', 'application/pdf'].includes(this.file.type))
    ) {
      this.file = null;
      input.value = '';
      this.error.set('Selecciona un JPG, PNG o PDF de hasta 5 MB.');
    }
  }
  upload(input: HTMLInputElement) {
    const id = this.editingId();
    if (!id || !this.file || this.dirty || this.busy()) return;
    if (this.kind === 'DOCUMENTO_HIJO' && !this.relativeId) {
      this.error.set('Selecciona el hijo al que corresponde el documento.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .upload(id, this.kind, this.kind === 'DOCUMENTO_HIJO' ? this.relativeId : '', this.file)
      .subscribe({
        next: () => {
          input.value = '';
          this.refreshDocuments(id, 'Documento guardado.');
        },
        error: (e) => {
          this.busy.set(false);
          this.fail(e);
        },
      });
  }
  removeDocument(document: PersonDocument) {
    const id = this.editingId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.api.remove(id, document.id).subscribe({
      next: () => this.refreshDocuments(id, 'Documento eliminado.'),
      error: (e) => {
        this.busy.set(false);
        this.fail(e);
      },
    });
  }
  private refreshDocuments(id: string, message: string) {
    this.api
      .get(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (person) => {
          this.documents.set(person.documents);
          this.file = null;
          this.pendingDelete = '';
          this.message.set(message);
        },
        error: (e) => this.fail(e),
      });
  }
  download(document: PersonDocument) {
    const id = this.editingId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.api
      .download(id, document)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = window.document.createElement('a');
          link.href = url;
          link.download = document.originalName;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () =>
          this.error.set(
            'No se pudo descargar el archivo. Verifica tus permisos e inténtalo de nuevo.',
          ),
      });
  }
  private fail(error: { error?: { message?: string | string[] } }) {
    const message = error.error?.message;
    this.error.set(
      Array.isArray(message)
        ? message.join(' ')
        : message || 'No fue posible completar la operación.',
    );
  }
}
