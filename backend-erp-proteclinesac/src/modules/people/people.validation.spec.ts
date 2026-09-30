import {
  maxFileSize,
  validatePerson,
  validateUpload,
} from './people.validation.js';

const base = {
  profile: 'ALUMNO',
  gender: 'Femenino',
  firstName: 'Ana',
  lastName: 'Pérez',
  documentType: 'DNI',
  documentNumber: '12345678',
  activatedAt: '2026-09-22',
};
describe('Person validation', () => {
  it.each([undefined, null, '', 'Prefiero no decirlo', 'Otro'])(
    'requires one of the two gender options: %s',
    (gender) => {
      expect(() => validatePerson({ ...base, gender })).toThrow();
    },
  );
  it('normalizes previous marital status values and accepts the new reference', () => {
    expect(
      validatePerson({
        ...base,
        maritalStatus: 'Casada',
        reference: ' Frente al parque ',
      }),
    ).toMatchObject({
      maritalStatus: 'Casado/a',
      reference: 'Frente al parque',
    });
    expect(() => validatePerson({ ...base, maritalStatus: 'Otro' })).toThrow();
  });
  it('derives the complete location from a six-digit string without losing leading zeros', () => {
    expect(validatePerson({ ...base, ubigeo: '010102' })).toMatchObject({
      country: 'Perú',
      department: 'Amazonas',
      province: 'Chachapoyas',
      district: 'Asunción',
      ubigeo: '010102',
    });
  });
  it.each([
    { ubigeo: 10102 },
    { ubigeo: '10102' },
    { ubigeo: '999999' },
    { ubigeo: '010102', province: 'Bagua' },
    { ubigeo: '010102', district: 'Lima' },
    { ubigeo: '010102', country: 'Chile' },
    { department: 'Amazonas' },
  ])('rejects unknown or inconsistent UBIGEO inputs %j', (location) => {
    expect(() => validatePerson({ ...base, ...location })).toThrow();
  });
  it('preserves legacy text locations without assigning an unverified code', () => {
    expect(
      validatePerson({
        ...base,
        country: 'Perú',
        city: 'Lima',
        district: 'San Juan',
      }),
    ).toMatchObject({ city: 'Lima', district: 'San Juan', ubigeo: null });
  });
  it.each(['ALUMNO', 'DOCENTE', 'COLABORADOR'])(
    'allows %s to save before uploading documents',
    (profile) => {
      expect(validatePerson({ ...base, profile }).relatives).toEqual([]);
    },
  );
  it.each([
    ['DNI', '123'],
    ['DNI', '1234567A'],
    ['RUC', '12345678'],
    ['CE', '123'],
    ['PASAPORTE', '<script>'],
  ])('rejects malformed %s', (documentType, documentNumber) => {
    expect(() =>
      validatePerson({ ...base, documentType, documentNumber }),
    ).toThrow('Número de documento inválido');
  });
  it.each([
    null,
    {},
    { ...base, firstName: '  ' },
    { ...base, personalEmail: 'bad-email' },
    { ...base, activatedAt: 'bad-date' },
    { ...base, institutionId: 'spoof' },
    { ...base, profile: 'ADMIN' },
  ])('rejects invalid or unauthorized fields', (input) => {
    expect(() => validatePerson(input)).toThrow();
  });
  it('rejects duplicate parents but allows several children', () => {
    const relative = {
      relationship: 'PADRE',
      firstName: 'Juan',
      lastName: 'Pérez',
      documentNumber: '87654321',
    };
    expect(() =>
      validatePerson({ ...base, relatives: [relative, relative] }),
    ).toThrow('un padre');
    expect(
      validatePerson({
        ...base,
        relatives: [
          relative,
          { ...relative, relationship: 'HIJO' },
          { ...relative, relationship: 'HIJO' },
        ],
      }).relatives,
    ).toHaveLength(3);
  });
  it('rejects repeated IDs when modifying relatives', () => {
    const relative = {
      id: '4acfa706-6a43-455b-8d68-bc36387ae723',
      relationship: 'HIJO',
      firstName: 'Juan',
      lastName: 'Pérez',
      documentNumber: '87654321',
    };
    expect(() =>
      validatePerson({ ...base, relatives: [relative, relative] }),
    ).toThrow('repetidos');
  });
});
describe('Document uploads', () => {
  const pdf = {
    buffer: Buffer.from('%PDF-1.4 test'),
    mimetype: 'application/pdf',
    originalname: 'cv.pdf',
    size: 13,
  };
  it('accepts a PDF with matching extension and MIME', () =>
    expect(validateUpload(pdf)).toBe('application/pdf'));
  it('rejects executable or HTML content disguised as a document', () =>
    expect(() =>
      validateUpload({
        ...pdf,
        buffer: Buffer.from('<script>alert(1)</script>'),
      }),
    ).toThrow());
  it('rejects a mismatched extension or MIME', () => {
    expect(() =>
      validateUpload({ ...pdf, originalname: 'file.exe' }),
    ).toThrow();
    expect(() => validateUpload({ ...pdf, mimetype: 'image/png' })).toThrow();
  });
  it('rejects missing, empty and oversized files', () => {
    expect(() => validateUpload(undefined)).toThrow();
    expect(() => validateUpload({ ...pdf, buffer: Buffer.alloc(0) })).toThrow();
    expect(() => validateUpload({ ...pdf, size: maxFileSize + 1 })).toThrow();
  });
});
