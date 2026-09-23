import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import {
  documentKinds,
  validatePerson,
  validateUpload,
  workDocumentKinds,
} from './people.validation.js';
import type { Upload } from './people.validation.js';

const include = {
  relatives: true,
  documents: {
    select: {
      id: true,
      relativeId: true,
      kind: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PersonInclude;
@Injectable()
export class PeopleService {
  constructor(
    private readonly auth: AuthService,
    private readonly database: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private get db() {
    return this.database.getClient();
  }
  private get storage() {
    return resolve(
      this.config.get<string>('PERSON_DOCUMENTS_DIR') ||
        'storage/person-documents',
    );
  }

  async list(token: string, search = '', page = '1') {
    const context = await this.auth.requirePermission(token, 'people.view');
    const index = Math.max(1, Math.min(100000, Number.parseInt(page, 10) || 1));
    const terms = search.trim().slice(0, 100).split(/\s+/).filter(Boolean);
    const where: Prisma.PersonWhereInput = {
      institutionId: context.institutionId,
      ...(terms.length
        ? {
            AND: terms.map((term) => ({
              OR: [
                'firstName',
                'middleName',
                'lastName',
                'secondLastName',
                'documentNumber',
              ].map((field) => ({
                [field]: { contains: term, mode: 'insensitive' },
              })),
            })),
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.person.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          secondLastName: true,
          profile: true,
          status: true,
          documentType: true,
          documentNumber: true,
        },
        orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
        skip: (index - 1) * 25,
        take: 25,
      }),
      this.db.person.count({ where }),
    ]);
    return { items, total, page: index };
  }
  async get(token: string, id: string) {
    const context = await this.auth.requirePermission(token, 'people.view');
    const person = await this.db.person.findFirst({
      where: { id, institutionId: context.institutionId },
      include,
    });
    if (!person) throw new NotFoundException('Persona no encontrada.');
    return person;
  }
  async accounts(token: string) {
    const context = await this.auth.requirePermission(token, 'people.edit');
    return this.db.institutionMembership.findMany({
      where: { institutionId: context.institutionId },
      select: {
        id: true,
        studentCode: true,
        user: { select: { documentType: true, documentNumber: true } },
      },
      orderBy: { studentCode: 'asc' },
    });
  }
  async save(token: string, id: string | null, body: unknown) {
    const context = await this.auth.requirePermission(
      token,
      id ? 'people.edit' : 'people.create',
    );
    const { relatives, ...input } = validatePerson(body);
    if (input.membershipId)
      await this.auth.requirePermission(token, 'people.edit');
    try {
      return await this.db.$transaction(async (tx) => {
        if (
          id &&
          !(await tx.person.findFirst({
            where: { id, institutionId: context.institutionId },
          }))
        )
          throw new NotFoundException('Persona no encontrada.');
        if (input.membershipId) {
          const account = await tx.institutionMembership.findFirst({
            where: {
              id: input.membershipId,
              institutionId: context.institutionId,
            },
            include: { user: true },
          });
          if (
            !account ||
            account.user.documentType !== input.documentType ||
            account.user.documentNumber !== input.documentNumber
          )
            throw new BadRequestException(
              'La cuenta vinculada debe pertenecer a esta institución y tener el mismo documento.',
            );
        }
        const existing = id
          ? await tx.personRelative.findMany({ where: { personId: id } })
          : [];
        if (relatives.some((r) => r.id && !existing.some((e) => e.id === r.id)))
          throw new BadRequestException('Familiar ajeno a la ficha.');
        const kept = relatives.flatMap((r) => (r.id ? [r.id] : []));
        const removed = existing
          .filter((r) => !kept.includes(r.id))
          .map((r) => r.id);
        if (
          removed.length &&
          (await tx.personDocument.count({
            where: { relativeId: { in: removed } },
          }))
        )
          throw new BadRequestException(
            'Retira primero los documentos de los familiares que deseas eliminar.',
          );
        const changingChild = relatives
          .filter((r) => r.id && r.relationship !== 'HIJO')
          .flatMap((r) => (r.id ? [r.id] : []));
        if (
          changingChild.length &&
          (await tx.personDocument.count({
            where: { relativeId: { in: changingChild } },
          }))
        )
          throw new BadRequestException(
            'Retira el documento del hijo antes de cambiar su parentesco.',
          );
        const data = { ...input, activatedAt: new Date(input.activatedAt) };
        const person = id
          ? await tx.person.update({ where: { id }, data })
          : await tx.person.create({
              data: { ...data, institutionId: context.institutionId },
            });
        if (removed.length)
          await tx.personRelative.deleteMany({
            where: { personId: person.id, id: { in: removed } },
          });
        for (const relative of relatives) {
          const { id: relativeId, ...fields } = relative;
          if (relativeId)
            await tx.personRelative.update({
              where: { id: relativeId },
              data: fields,
            });
          else
            await tx.personRelative.create({
              data: { ...fields, personId: person.id },
            });
        }
        await tx.auditEvent.create({
          data: {
            actorUserId: context.userId,
            institutionId: context.institutionId,
            eventType: id ? 'people.updated' : 'people.created',
            entityType: 'Person',
            entityId: person.id,
          },
        });
        return tx.person.findUniqueOrThrow({
          where: { id: person.id },
          include,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Ya existe una persona con ese documento o esa cuenta vinculada en la institución.',
        );
      throw error;
    }
  }
  async upload(
    token: string,
    id: string,
    kind: string,
    relativeId: string | undefined,
    file: Upload | undefined,
  ) {
    const context = await this.auth.requirePermission(token, 'people.edit');
    const mimeType = validateUpload(file);
    if (!documentKinds.includes(kind))
      throw new BadRequestException('Tipo de archivo desconocido.');
    const person = await this.db.person.findFirst({
      where: { id, institutionId: context.institutionId },
      include: { relatives: true },
    });
    if (!person) throw new NotFoundException('Persona no encontrada.');
    if (person.profile === 'ALUMNO' && workDocumentKinds.includes(kind))
      throw new BadRequestException(
        'Los alumnos no requieren documentos laborales.',
      );
    if (
      kind === 'DOCUMENTO_HIJO'
        ? !person.relatives.some(
            (r) => r.id === relativeId && r.relationship === 'HIJO',
          )
        : !!relativeId
    )
      throw new BadRequestException(
        'Selecciona un hijo de esta ficha para su documento.',
      );
    const storageKey = randomUUID();
    await mkdir(this.storage, { recursive: true });
    await writeFile(resolve(this.storage, storageKey), file!.buffer, {
      flag: 'wx',
      mode: 0o600,
    });
    try {
      return await this.db.$transaction(async (tx) => {
        const document = await tx.personDocument.create({
          data: {
            personId: id,
            relativeId: relativeId || null,
            kind,
            originalName: Array.from(file!.originalname, (char) =>
              char.charCodeAt(0) < 32 ||
              char === '/' ||
              char === String.fromCharCode(92)
                ? '_'
                : char,
            )
              .join('')
              .slice(0, 255),
            storageKey,
            mimeType,
            size: file!.buffer.length,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: context.userId,
            institutionId: context.institutionId,
            eventType: 'people.document.uploaded',
            entityType: 'Person',
            entityId: id,
          },
        });
        return { id: document.id };
      });
    } catch (error) {
      await unlink(resolve(this.storage, storageKey)).catch(() => undefined);
      throw error;
    }
  }
  async download(token: string, personId: string, id: string) {
    const context = await this.auth.requirePermission(token, 'people.view');
    const document = await this.db.personDocument.findFirst({
      where: { id, personId, person: { institutionId: context.institutionId } },
    });
    if (!document) throw new NotFoundException('Documento no encontrado.');
    let buffer: Buffer;
    try {
      buffer = await readFile(resolve(this.storage, document.storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('Archivo no disponible.');
      throw error;
    }
    await this.db.auditEvent.create({
      data: {
        actorUserId: context.userId,
        institutionId: context.institutionId,
        eventType: 'people.document.downloaded',
        entityType: 'PersonDocument',
        entityId: id,
      },
    });
    return { buffer, mimeType: document.mimeType, name: document.originalName };
  }
  async removeDocument(token: string, personId: string, id: string) {
    const context = await this.auth.requirePermission(token, 'people.edit');
    const document = await this.db.personDocument.findFirst({
      where: { id, personId, person: { institutionId: context.institutionId } },
    });
    if (!document) throw new NotFoundException('Documento no encontrado.');
    // Remove bytes first: on storage failure the record remains available for retry.
    await unlink(resolve(this.storage, document.storageKey)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await this.db.$transaction([
      this.db.personDocument.delete({ where: { id } }),
      this.db.auditEvent.create({
        data: {
          actorUserId: context.userId,
          institutionId: context.institutionId,
          eventType: 'people.document.deleted',
          entityType: 'PersonDocument',
          entityId: id,
        },
      }),
    ]);
    return { deleted: true };
  }
}
