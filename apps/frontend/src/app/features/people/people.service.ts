import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export const fields = [
  { key: 'firstName', label: 'Primer nombre', required: true, max: 100, type: 'text' },
  { key: 'middleName', label: 'Segundo nombre', required: false, max: 100, type: 'text' },
  { key: 'lastName', label: 'Primer apellido', required: true, max: 100, type: 'text' },
  { key: 'secondLastName', label: 'Segundo apellido', required: false, max: 100, type: 'text' },
  { key: 'gender', label: 'Género', required: false, max: 50, type: 'text' },
  { key: 'maritalStatus', label: 'Estado civil', required: false, max: 50, type: 'text' },
  { key: 'personalEmail', label: 'Correo personal', required: false, max: 254, type: 'email' },
  {
    key: 'institutionalEmail',
    label: 'Correo institucional',
    required: false,
    max: 254,
    type: 'email',
  },
  { key: 'phone', label: 'Teléfono', required: false, max: 30, type: 'tel' },
  { key: 'referencePhone', label: 'Teléfono de referencia', required: false, max: 30, type: 'tel' },
  { key: 'country', label: 'País', required: false, max: 100, type: 'text' },
  { key: 'city', label: 'Ciudad', required: false, max: 100, type: 'text' },
  { key: 'district', label: 'Distrito', required: false, max: 100, type: 'text' },
  { key: 'address', label: 'Dirección', required: false, max: 300, type: 'text' },
] as const;
export interface Relative {
  id?: string;
  relationship: string;
  firstName: string;
  lastName: string;
  gender: string;
  documentNumber: string;
}
export interface PersonDocument {
  id: string;
  relativeId: string | null;
  kind: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
export type PersonForm = Record<(typeof fields)[number]['key'], string> & {
  profile: string;
  status: string;
  activatedAt: string;
  documentType: string;
  documentNumber: string;
  membershipId: string;
  relatives: Relative[];
};
export type Person = PersonForm & { id: string; documents: PersonDocument[] };
export interface PersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  profile: string;
  status: string;
  documentType: string;
  documentNumber: string;
}
export interface Account {
  id: string;
  studentCode: string | null;
  user: { documentType: string | null; documentNumber: string | null };
}
export const documentKinds = [
  { value: 'IDENTIDAD_ANVERSO', label: 'Documento de identidad · anverso', work: false },
  { value: 'IDENTIDAD_REVERSO', label: 'Documento de identidad · reverso', work: false },
  { value: 'FOTO_CARNET', label: 'Foto carnet', work: false },
  { value: 'RECIBO_LUZ', label: 'Recibo de luz', work: true },
  { value: 'CV', label: 'Currículum vitae', work: true },
  { value: 'CERTIJOVEN', label: 'Certijoven', work: true },
  { value: 'CERTIFICADO_ESTUDIOS', label: 'Certificado de estudios', work: true },
  { value: 'DOCUMENTO_HIJO', label: 'Documento de un hijo', work: false },
];
@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:3000/people';
  private readonly options = { withCredentials: true };
  list(search: string, page: number) {
    return this.http.get<{ items: PersonSummary[]; total: number; page: number }>(this.url, {
      ...this.options,
      params: { search, page },
    });
  }
  get(id: string) {
    return this.http.get<Person>(`${this.url}/${id}`, this.options);
  }
  accounts() {
    return this.http.get<Account[]>(`${this.url}/accounts`, this.options);
  }
  save(id: string | null, form: PersonForm) {
    return id
      ? this.http.put<Person>(`${this.url}/${id}`, form, this.options)
      : this.http.post<Person>(this.url, form, this.options);
  }
  upload(id: string, kind: string, relativeId: string, file: File) {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    if (relativeId) form.append('relativeId', relativeId);
    return this.http.post(`${this.url}/${id}/documents`, form, this.options);
  }
  download(id: string, document: PersonDocument) {
    return this.http.get(`${this.url}/${id}/documents/${document.id}`, {
      ...this.options,
      responseType: 'blob',
    });
  }
  remove(id: string, documentId: string) {
    return this.http.delete(`${this.url}/${id}/documents/${documentId}`, this.options);
  }
}
