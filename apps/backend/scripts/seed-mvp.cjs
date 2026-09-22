const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const path = require('node:path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, AccountStatus } = require('@prisma/client');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const scrypt = promisify(scryptCallback);
const password = process.env.MVP_STUDENT_PASSWORD || 'ProtecEdu!2026';

async function hashPassword(value) {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derivedKey).toString('base64url')}`;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The MVP seed is only available outside production.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed the MVP.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const institution = await prisma.institution.upsert({
      where: { code: 'DEMO-EDU' },
      update: {
        name: 'Institución Demo ProtecEdu',
        codePrefix: 'D',
        isActive: true,
      },
      create: {
        code: 'DEMO-EDU',
        codePrefix: 'D',
        name: 'Institución Demo ProtecEdu',
      },
    });
    const permissionCodes = [
      'profile.read',
      'people.view',
      'people.create',
      'people.edit',
      'users.view',
      'users.create',
      'users.edit',
      'users.deactivate',
      'users.block',
      'roles.view',
      'roles.create',
      'roles.edit',
      'permissions.view',
      'permissions.create',
      'audit.view',
    ];
    const permissions = await Promise.all(
      permissionCodes.map((code) => {
        const [resource, action] = code.split('.');
        return prisma.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {},
          create: { resource, action },
        });
      }),
    );
    const roles = [
      ['SUPERADMINISTRADOR', 'Superadministrador', permissionCodes],
      [
        'ADMINISTRADOR',
        'Administrador',
        permissionCodes.filter(
          (code) => !code.startsWith('permissions.create'),
        ),
      ],
      ['COLABORADOR', 'Colaborador', ['profile.read', 'users.view']],
      ['DOCENTE', 'Docente', ['profile.read']],
      ['ESTUDIANTE', 'Estudiante', ['profile.read']],
    ];
    const roleByCode = new Map();
    for (const [code, name, codes] of roles) {
      const role = await prisma.role.upsert({
        where: { institutionId_code: { institutionId: institution.id, code } },
        update: { name, isActive: true },
        create: { institutionId: institution.id, code, name },
      });
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({
        data: permissions
          .filter((permission) =>
            codes.includes(`${permission.resource}.${permission.action}`),
          )
          .map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
      });
      roleByCode.set(code, role);
    }

    const demoAccounts = [
      [
        '71456780',
        'D026100001',
        'superadmin@protecedu.local',
        'SUPERADMINISTRADOR',
      ],
      ['71456781', 'D026100002', 'admin@protecedu.local', 'ADMINISTRADOR'],
      ['71456782', 'D026100003', 'colaborador@protecedu.local', 'COLABORADOR'],
      ['71456783', 'D026100004', 'docente@protecedu.local', 'DOCENTE'],
      ['71456789', 'D026100005', 'estudiante@protecedu.local', 'ESTUDIANTE'],
    ];
    await prisma.$executeRaw`
      INSERT INTO "institutional_code_sequences"
        ("id", "institutionId", "academicYear", "period", "lastValue", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${institution.id}::uuid, 2026, 1, 5, NOW(), NOW())
      ON CONFLICT ("institutionId", "academicYear", "period")
      DO UPDATE SET
        "lastValue" = GREATEST("institutional_code_sequences"."lastValue", 5),
        "updatedAt" = NOW();
    `;
    const passwordHash = await hashPassword(password);
    for (const [documentNumber, studentCode, email, roleCode] of demoAccounts) {
      const user = await prisma.user.upsert({
        where: {
          documentType_documentNumber: { documentType: 'DNI', documentNumber },
        },
        update: {
          email,
          passwordHash,
          mustChangePassword: false,
          status: AccountStatus.ACTIVA,
          failedLoginAttempts: 0,
          lockedAt: null,
          isSuperAdministrator: roleCode === 'SUPERADMINISTRADOR',
        },
        create: {
          documentType: 'DNI',
          documentNumber,
          email,
          passwordHash,
          mustChangePassword: false,
          status: AccountStatus.ACTIVA,
          isSuperAdministrator: roleCode === 'SUPERADMINISTRADOR',
        },
      });
      const membership = await prisma.institutionMembership.upsert({
        where: {
          userId_institutionId: {
            userId: user.id,
            institutionId: institution.id,
          },
        },
        update: { studentCode, isActive: true },
        create: { userId: user.id, institutionId: institution.id, studentCode },
      });
      await prisma.userRole.deleteMany({
        where: { membershipId: membership.id },
      });
      await prisma.userRole.create({
        data: {
          membershipId: membership.id,
          roleId: roleByCode.get(roleCode).id,
          institutionId: institution.id,
        },
      });
    }

    console.log('MVP demo accounts are ready for DEMO-EDU.');
    if (!process.env.MVP_STUDENT_PASSWORD) {
      console.log('Local development password: ProtecEdu!2026');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
