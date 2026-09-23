import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PeopleModule } from '../../src/modules/people/people.module.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { DatabaseModule } from '../../src/shared/database/database.module.js';
import { SecurityModule } from '../../src/shared/security/security.module.js';
import { PrismaService } from '../../src/shared/database/prisma.service.js';

describe('People API with PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let institutionId: string;
  let otherInstitutionId: string;
  let userId: string;
  let storage: string;
  let personId: string;
  const base = {
    profile: 'ALUMNO',
    firstName: 'Ana',
    lastName: 'Prueba',
    documentType: 'DNI',
    documentNumber: '12345678',
    activatedAt: '2026-09-22',
  };
  const cookie = (role = 'writer') => `protecedu_session=${role}`;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const connection = process.env.TEST_DATABASE_URL;
    if (!connection) throw new Error('TEST_DATABASE_URL is required');
    const target = new URL(connection);
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
      target.pathname !== '/protecedu_test'
    )
      throw new Error('People tests require local protecedu_test');
    if (
      process.env.DATABASE_URL &&
      new URL(process.env.DATABASE_URL).pathname === target.pathname
    )
      throw new Error('Test database must differ from development');
    storage = await mkdtemp(join(tmpdir(), 'protecedu-people-'));
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: connection,
              PERSON_DOCUMENTS_DIR: storage,
              SESSION_COOKIE_NAME: 'protecedu_session',
            }),
          ],
        }),
        DatabaseModule,
        SecurityModule,
        PeopleModule,
      ],
    })
      .overrideProvider(AuthService)
      .useValue({
        requirePermission: async (token: string, permission: string) => {
          if (!['writer', 'reader', 'outsider'].includes(token))
            throw new UnauthorizedException();
          if (token === 'reader' && permission !== 'people.view')
            throw new ForbiddenException();
          return {
            userId,
            institutionId:
              token === 'outsider' ? otherInstitutionId : institutionId,
            isSuperAdministrator: false,
            permissions: [permission],
          };
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = module.get(PrismaService).getClient();
    const suffix = randomUUID();
    institutionId = (
      await db.institution.create({
        data: {
          code: `PEOPLE-${suffix}`,
          codePrefix: 'P',
          name: 'People tests',
        },
      })
    ).id;
    otherInstitutionId = (
      await db.institution.create({
        data: { code: `OTHER-${suffix}`, codePrefix: 'Q', name: 'Other tests' },
      })
    ).id;
    userId = (await db.user.create({ data: { passwordHash: 'test-only' } })).id;
  });
  afterAll(async () => {
    if (db && institutionId) {
      const ids = [institutionId, otherInstitutionId].filter(Boolean);
      await db.personDocument.deleteMany({
        where: { person: { institutionId: { in: ids } } },
      });
      await db.personRelative.deleteMany({
        where: { person: { institutionId: { in: ids } } },
      });
      await db.person.deleteMany({ where: { institutionId: { in: ids } } });
      await db.auditEvent.deleteMany({ where: { institutionId: { in: ids } } });
      await db.institutionMembership.deleteMany({
        where: { institutionId: { in: ids } },
      });
      await db.institution.deleteMany({ where: { id: { in: ids } } });
      if (userId) await db.user.delete({ where: { id: userId } });
    }
    if (app) await app.close();
    if (storage) {
      for (const name of await readdir(storage))
        await unlink(join(storage, name));
      await rmdir(storage);
    }
  });

  it('matches full names across fields while preserving institution scope', async () => {
    const data = {
      firstName: 'Pablo',
      middleName: 'Andrés',
      lastName: 'Calderon',
      secondLastName: 'Vilca',
      documentType: 'DNI',
      documentNumber: '55667788',
      profile: 'ALUMNO' as const,
    };
    const person = await db.person.create({ data: { ...data, institutionId } });
    await db.person.create({
      data: { ...data, institutionId: otherInstitutionId },
    });
    for (const search of [
      'Pablo',
      'Pablo Calderon Vilca',
      '  pablo   CALDERON  vilca ',
      'Vilca Pablo',
      'Pablo Andrés',
      '55667788',
    ]) {
      const response = await api()
        .get('/people')
        .query({ search })
        .set('Cookie', cookie('reader'))
        .expect(200);
      expect(response.body.total).toBe(1);
      expect(
        response.body.items.map((item: { id: string }) => item.id),
      ).toEqual([person.id]);
    }
    const mismatch = await api()
      .get('/people')
      .query({ search: 'Pablo OtroApellido' })
      .set('Cookie', cookie('reader'))
      .expect(200);
    expect(mismatch.body.total).toBe(0);
    await db.person.deleteMany({
      where: {
        institutionId: { in: [institutionId, otherInstitutionId] },
        documentNumber: data.documentNumber,
      },
    });
  });

  it('rejects unauthenticated and read-only creation', async () => {
    await api().post('/people').send(base).expect(401);
    await api()
      .post('/people')
      .set('Cookie', cookie('reader'))
      .send(base)
      .expect(403);
  });
  it('creates an alumno without attachments and rejects a duplicate', async () => {
    const response = await api()
      .post('/people')
      .set('Cookie', cookie())
      .send(base)
      .expect(201);
    personId = response.body.id;
    expect(response.body.documents).toEqual([]);
    await api().post('/people').set('Cookie', cookie()).send(base).expect(409);
    await api()
      .post('/people')
      .set('Cookie', cookie())
      .send({ ...base, documentNumber: '1' })
      .expect(400);
  });
  it('lists and reads only within the session institution', async () => {
    const response = await api()
      .get('/people?search=Prueba')
      .set('Cookie', cookie('reader'))
      .expect(200);
    expect(response.body.total).toBe(1);
    await api()
      .get(`/people/${personId}`)
      .set('Cookie', cookie('outsider'))
      .expect(404);
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie('outsider'))
      .send(base)
      .expect(404);
    expect(
      (await api().get('/people').set('Cookie', cookie('outsider')).expect(200))
        .body.total,
    ).toBe(0);
  });
  it('rejects foreign account linking and accepts matching institutional identity', async () => {
    await db.user.update({
      where: { id: userId },
      data: { documentType: 'DNI', documentNumber: base.documentNumber },
    });
    const foreign = await db.institutionMembership.create({
      data: { institutionId: otherInstitutionId, userId },
    });
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send({ ...base, membershipId: foreign.id })
      .expect(400);
    const local = await db.institutionMembership.create({
      data: { institutionId, userId },
    });
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send({ ...base, membershipId: local.id })
      .expect(200);
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send({ ...base, membershipId: local.id, documentNumber: '23456789' })
      .expect(400);
  });
  it('stores relatives, protects child ownership and serves private files', async () => {
    const relative = {
      relationship: 'HIJO',
      firstName: 'Luis',
      lastName: 'Prueba',
      documentNumber: '98765432',
    };
    const response = await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send({ ...base, relatives: [relative] })
      .expect(200);
    const relativeId = response.body.relatives[0].id;
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send({ ...base, relatives: [{ ...relative, id: randomUUID() }] })
      .expect(400);
    await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie())
      .field('kind', 'CV')
      .attach('file', Buffer.from('%PDF-1.4 test'), 'cv.pdf')
      .expect(400);
    await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie('reader'))
      .field('kind', 'FOTO_CARNET')
      .attach('file', Buffer.from('x'), 'foto.png')
      .expect(403);
    await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie())
      .field('kind', 'DOCUMENTO_HIJO')
      .field('relativeId', randomUUID())
      .attach('file', Buffer.from('%PDF-1.4 test'), 'child.pdf')
      .expect(400);
    const doc = await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie())
      .field('kind', 'DOCUMENTO_HIJO')
      .field('relativeId', relativeId)
      .attach('file', Buffer.from('%PDF-1.4 test'), 'child.pdf')
      .expect(201);
    const url = `/people/${personId}/documents/${doc.body.id}`;
    await api().get(url).expect(401);
    await api().get(url).set('Cookie', cookie('outsider')).expect(404);
    const download = await api()
      .get(url)
      .set('Cookie', cookie('reader'))
      .expect(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.body.toString()).toBe('%PDF-1.4 test');
    const detail = await api()
      .get(`/people/${personId}`)
      .set('Cookie', cookie())
      .expect(200);
    expect(detail.body.documents[0].storageKey).toBeUndefined();
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send(base)
      .expect(400);
    await api().delete(url).set('Cookie', cookie('outsider')).expect(404);
    await api().delete(url).set('Cookie', cookie()).expect(200);
    await api().get(url).set('Cookie', cookie()).expect(404);
    await api()
      .put(`/people/${personId}`)
      .set('Cookie', cookie())
      .send(base)
      .expect(200);
    expect(
      await db.auditEvent.count({
        where: { institutionId, eventType: 'people.document.downloaded' },
      }),
    ).toBe(1);
  });
  it('rejects files with fake signatures and oversized multipart content', async () => {
    await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie())
      .field('kind', 'FOTO_CARNET')
      .attach('file', Buffer.from('not-a-png'), 'foto.png')
      .expect(400);
    await api()
      .post(`/people/${personId}/documents`)
      .set('Cookie', cookie())
      .field('kind', 'IDENTIDAD_ANVERSO')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.pdf')
      .expect(413);
  });
});
