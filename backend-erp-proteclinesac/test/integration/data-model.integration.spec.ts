import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { InstitutionalCodeService } from '../../src/shared/security/institutional-code.service.js';

describe('base identity and authorization data model', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL is required for integration tests.');
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.auditEvent.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.institutionMembership.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.institution.deleteMany();
    await prisma.$disconnect();
  });

  it('enforces institutional relationships and audit references', async () => {
    const firstInstitution = await prisma.institution.create({
      data: { code: 'INST-ONE', codePrefix: 'A', name: 'Institution One' },
    });
    const secondInstitution = await prisma.institution.create({
      data: { code: 'INST-TWO', codePrefix: 'B', name: 'Institution Two' },
    });
    const codeGenerator = new InstitutionalCodeService({
      getClient: () => prisma,
    } as never);
    const generatedCodes = await Promise.all(
      Array.from({ length: 25 }, () =>
        codeGenerator.next(firstInstitution.id, 2026, 1),
      ),
    );
    expect(new Set(generatedCodes)).toHaveLength(25);
    expect(generatedCodes).toContain('A026100001');
    expect(generatedCodes).toContain('A026100025');
    expect(await codeGenerator.next(firstInstitution.id, 2026, 2)).toBe(
      'A026200001',
    );
    const user = await prisma.user.create({
      data: {
        documentType: 'DNI',
        documentNumber: '10000001',
        passwordHash: 'not-an-authentication-implementation',
      },
    });
    const secondUser = await prisma.user.create({
      data: {
        documentType: 'DNI',
        documentNumber: '10000002',
        passwordHash: 'not-an-authentication-implementation',
      },
    });
    const firstMembership = await prisma.institutionMembership.create({
      data: {
        userId: user.id,
        institutionId: firstInstitution.id,
        studentCode: 'A026100001',
      },
    });
    await prisma.institutionMembership.create({
      data: {
        userId: user.id,
        institutionId: secondInstitution.id,
        studentCode: 'B026100001',
      },
    });
    const firstRole = await prisma.role.create({
      data: {
        institutionId: firstInstitution.id,
        code: 'COLLABORATOR',
        name: 'Collaborator',
      },
    });
    const secondRole = await prisma.role.create({
      data: {
        institutionId: secondInstitution.id,
        code: 'TEACHER',
        name: 'Teacher',
      },
    });
    const additionalFirstRole = await prisma.role.create({
      data: {
        institutionId: firstInstitution.id,
        code: 'TEACHER',
        name: 'Teacher',
      },
    });
    const firstPermission = await prisma.permission.create({
      data: { resource: 'users', action: 'read' },
    });
    const secondPermission = await prisma.permission.create({
      data: { resource: 'users', action: 'update' },
    });

    await prisma.rolePermission.create({
      data: { roleId: firstRole.id, permissionId: firstPermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: firstRole.id, permissionId: secondPermission.id },
    });
    await prisma.userRole.create({
      data: {
        membershipId: firstMembership.id,
        roleId: firstRole.id,
        institutionId: firstInstitution.id,
      },
    });
    await prisma.userRole.create({
      data: {
        membershipId: firstMembership.id,
        roleId: additionalFirstRole.id,
        institutionId: firstInstitution.id,
      },
    });

    await expect(
      prisma.userRole.create({
        data: {
          membershipId: firstMembership.id,
          roleId: secondRole.id,
          institutionId: firstInstitution.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.institutionMembership.create({
        data: {
          userId: user.id,
          institutionId: firstInstitution.id,
          studentCode: 'A026100002',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.institutionMembership.create({
        data: {
          userId: secondUser.id,
          institutionId: firstInstitution.id,
          studentCode: 'A026100001',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.institutionMembership.create({
        data: {
          userId: secondUser.id,
          institutionId: secondInstitution.id,
          studentCode: '   ',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.create({
        data: {
          passwordHash: 'not-an-authentication-implementation',
          failedLoginAttempts: -1,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.create({
        data: {
          documentType: 'DNI',
          passwordHash: 'not-an-authentication-implementation',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.institution.create({
        data: { code: '   ', codePrefix: 'Z', name: 'Invalid Institution' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.role.create({
        data: {
          institutionId: firstInstitution.id,
          code: '   ',
          name: 'Invalid Role',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.permission.create({
        data: { resource: '   ', action: 'read' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.permission.create({
        data: { resource: 'roles', action: '   ' },
      }),
    ).rejects.toThrow();

    await prisma.auditEvent.createMany({
      data: [
        {
          actorUserId: user.id,
          institutionId: firstInstitution.id,
          eventType: 'test.actor-present',
          entityType: 'User',
          entityId: user.id,
        },
        {
          eventType: 'test.actor-absent',
        },
      ],
    });

    expect(await prisma.userRole.count()).toBe(2);
    expect(await prisma.rolePermission.count()).toBe(2);
    expect(await prisma.auditEvent.count()).toBe(2);
  });
});
