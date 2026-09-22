import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';

export type RelativeInput = {
  id?: string;
  relationship: 'PADRE' | 'MADRE' | 'HIJO';
  firstName: string;
  lastName: string;
  gender: string | null;
  documentNumber: string;
};
export type PersonInput = {
  profile: 'COLABORADOR' | 'DOCENTE' | 'ALUMNO';
  status: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
  activatedAt: string;
  membershipId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  gender: string | null;
  maritalStatus: string | null;
  documentType: string;
  documentNumber: string;
  personalEmail: string | null;
  institutionalEmail: string | null;
  phone: string | null;
  referencePhone: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  relatives: RelativeInput[];
};
const optionalText = (max = 100) =>
  Joi.string().trim().max(max).empty('').allow(null).default(null);
const email = () =>
  Joi.string()
    .trim()
    .max(254)
    .email({ tlds: { allow: false } })
    .empty('')
    .allow(null)
    .default(null);
const schema = Joi.object({
  profile: Joi.string().valid('COLABORADOR', 'DOCENTE', 'ALUMNO').required(),
  status: Joi.string()
    .valid('ACTIVO', 'INACTIVO', 'SUSPENDIDO')
    .default('ACTIVO'),
  activatedAt: Joi.string().isoDate().required(),
  membershipId: Joi.string().uuid().empty('').allow(null).default(null),
  firstName: Joi.string().trim().max(100).required(),
  middleName: optionalText(),
  lastName: Joi.string().trim().max(100).required(),
  secondLastName: optionalText(),
  gender: optionalText(50),
  maritalStatus: optionalText(50),
  documentType: Joi.string().valid('DNI', 'CE', 'PASAPORTE', 'RUC').required(),
  documentNumber: Joi.string().trim().uppercase().max(20).required(),
  personalEmail: email(),
  institutionalEmail: email(),
  phone: optionalText(30),
  referencePhone: optionalText(30),
  country: optionalText(),
  city: optionalText(),
  district: optionalText(),
  address: optionalText(300),
  relatives: Joi.array()
    .max(30)
    .items(
      Joi.object({
        id: Joi.string().uuid(),
        relationship: Joi.string().valid('PADRE', 'MADRE', 'HIJO').required(),
        firstName: Joi.string().trim().max(100).required(),
        lastName: Joi.string().trim().max(100).required(),
        gender: optionalText(50),
        documentNumber: Joi.string()
          .trim()
          .uppercase()
          .pattern(/^[A-Z0-9]{3,20}$/)
          .required(),
      }),
    )
    .default([]),
});

export function validatePerson(input: unknown): PersonInput {
  const { value, error } = schema.required().validate(input, { abortEarly: false });
  if (error)
    throw new BadRequestException(
      `Revisa los datos de la ficha: ${error.details.map((d) => d.path.join('.')).join(', ')}.`,
    );
  const person = value as PersonInput;
  const patterns: Record<string, RegExp> = {
    DNI: /^\d{8}$/,
    RUC: /^\d{11}$/,
    CE: /^[A-Z0-9]{9,12}$/,
    PASAPORTE: /^[A-Z0-9]{6,20}$/,
  };
  if (!patterns[person.documentType].test(person.documentNumber)) {
    throw new BadRequestException(
      'Número de documento inválido: DNI 8 dígitos, RUC 11 dígitos, CE 9–12 caracteres o pasaporte 6–20 caracteres alfanuméricos.',
    );
  }
  for (const relationship of ['PADRE', 'MADRE']) {
    if (
      person.relatives.filter((r) => r.relationship === relationship).length > 1
    )
      throw new BadRequestException(
        'Solo puedes registrar un padre y una madre.',
      );
  }
  const ids = person.relatives.flatMap((r) => (r.id ? [r.id] : []));
  if (new Set(ids).size !== ids.length)
    throw new BadRequestException('Hay familiares repetidos.');
  return person;
}

export const documentKinds = [
  'RECIBO_LUZ',
  'IDENTIDAD_ANVERSO',
  'IDENTIDAD_REVERSO',
  'CV',
  'CERTIJOVEN',
  'FOTO_CARNET',
  'CERTIFICADO_ESTUDIOS',
  'DOCUMENTO_HIJO',
];
export const workDocumentKinds = [
  'RECIBO_LUZ',
  'CV',
  'CERTIJOVEN',
  'CERTIFICADO_ESTUDIOS',
];
export const maxFileSize = 5 * 1024 * 1024;
export type Upload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};
export function validateUpload(file: Upload | undefined) {
  if (
    !file ||
    !file.buffer?.length ||
    file.size > maxFileSize ||
    file.buffer.length > maxFileSize
  )
    throw new BadRequestException('Selecciona un archivo de hasta 5 MB.');
  const b = file.buffer;
  const mime = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'image/png'
    : b[0] === 255 && b[1] === 216 && b[2] === 255
      ? 'image/jpeg'
      : b.subarray(0, 5).toString() === '%PDF-'
        ? 'application/pdf'
        : '';
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (
    !mime ||
    mime !== file.mimetype ||
    !{
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'application/pdf': ['pdf'],
    }[mime]?.includes(ext ?? '')
  ) {
    throw new BadRequestException(
      'El contenido y la extensión deben corresponder a un JPG, PNG o PDF.',
    );
  }
  return mime;
}
