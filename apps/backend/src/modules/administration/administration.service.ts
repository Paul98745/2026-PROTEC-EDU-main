import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { PasswordService } from '../../shared/security/password.service.js';
import { InstitutionalCodeService } from '../../shared/security/institutional-code.service.js';

type CreateUserInput = {
  documentType: string;
  documentNumber: string;
  academicPeriod?: number;
  email?: string;
  status?: AccountStatus;
  roleCodes: string[];
};

type UpdateUserInput = {
  email?: string | null;
  status?: AccountStatus;
  roleCodes?: string[];
};

type CreateRoleInput = {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
};

@Injectable()
export class AdministrationService {
  constructor(
    private readonly authService: AuthService,
    private readonly prismaService: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly institutionalCodeService: InstitutionalCodeService,
  ) {}

  async listUsers(token: string) {
    const context = await this.authService.requirePermission(
      token,
      'users.view',
    );
    const memberships = await this.prismaService
      .getClient()
      .institutionMembership.findMany({
        where: context.isSuperAdministrator
          ? undefined
          : { institutionId: context.institutionId },
        include: { user: true, userRoles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
      });

    return memberships.map((membership) => this.userView(membership));
  }

  async getUser(token: string, membershipId: string) {
    const context = await this.authService.requirePermission(
      token,
      'users.view',
    );
    const membership = await this.findMembership(
      membershipId,
      context.institutionId,
      context.isSuperAdministrator,
    );
    return this.userView(membership);
  }

  async createUser(token: string, input: CreateUserInput) {
    const context = await this.authService.requirePermission(
      token,
      'users.create',
    );
    this.ensureText(input.documentType, 'tipo de documento');
    this.ensureText(input.documentNumber, 'número de documento');
    const roles = await this.resolveRoles(
      context.institutionId,
      input.roleCodes,
    );
    const prisma = this.prismaService.getClient();
    const documentType = input.documentType.trim();
    const documentNumber = input.documentNumber.trim();
    const email = input.email?.trim() || null;
    const existingDocument = await prisma.user.findUnique({
      where: { documentType_documentNumber: { documentType, documentNumber } },
      select: { id: true },
    });
    if (existingDocument) {
      throw new ConflictException(
        'Ya existe un usuario con ese tipo y número de documento. Revisa los usuarios registrados.',
      );
    }
    if (
      email &&
      (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
    ) {
      throw new ConflictException(
        'Ya existe un usuario con ese correo electrónico.',
      );
    }
    const passwordHash = await this.passwordService.hash(input.documentNumber);
    const studentCode = await this.institutionalCodeService.next(
      context.institutionId,
      new Date().getFullYear(),
      input.academicPeriod ?? 1,
    );

    const membership = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user
        .create({
          data: {
            documentType,
            documentNumber,
            email,
            passwordHash,
            mustChangePassword: true,
            status: input.status ?? AccountStatus.ACTIVA,
          },
        })
        .catch((error: unknown) => {
          // A concurrent request may insert the identity after the checks above.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              'Ya existe un usuario con ese documento o correo electrónico. Revisa los usuarios registrados.',
            );
          }
          throw error;
        });
      const createdMembership = await transaction.institutionMembership.create({
        data: {
          userId: user.id,
          institutionId: context.institutionId,
          studentCode,
        },
      });
      await transaction.userRole.createMany({
        data: roles.map((role) => ({
          membershipId: createdMembership.id,
          roleId: role.id,
          institutionId: context.institutionId,
        })),
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: context.userId,
          institutionId: context.institutionId,
          eventType: 'admin.user.created',
          entityType: 'InstitutionMembership',
          entityId: createdMembership.id,
        },
      });
      return createdMembership;
    });

    return this.getUser(token, membership.id);
  }

  async updateUser(
    token: string,
    membershipId: string,
    input: UpdateUserInput,
  ) {
    const requiredPermission =
      input.status === AccountStatus.BLOQUEADA
        ? 'users.block'
        : input.status === AccountStatus.INACTIVA
          ? 'users.deactivate'
          : 'users.edit';
    const context = await this.authService.requirePermission(
      token,
      requiredPermission,
    );
    const membership = await this.findMembership(
      membershipId,
      context.institutionId,
      context.isSuperAdministrator,
    );
    const prisma = this.prismaService.getClient();

    if (input.roleCodes) {
      await this.resolveRoles(context.institutionId, input.roleCodes);
    }

    await prisma.$transaction(async (transaction) => {
      if (input.email !== undefined || input.status !== undefined) {
        await transaction.user.update({
          where: { id: membership.userId },
          data: {
            ...(input.email !== undefined
              ? { email: input.email?.trim() || null }
              : {}),
            ...(input.status !== undefined
              ? {
                  status: input.status,
                  lockedAt:
                    input.status === AccountStatus.BLOQUEADA
                      ? new Date()
                      : null,
                  failedLoginAttempts:
                    input.status === AccountStatus.BLOQUEADA
                      ? membership.user.failedLoginAttempts
                      : 0,
                }
              : {}),
          },
        });
      }
      if (input.roleCodes) {
        const roles = await this.resolveRoles(
          context.institutionId,
          input.roleCodes,
        );
        await transaction.userRole.deleteMany({
          where: { membershipId: membership.id },
        });
        await transaction.userRole.createMany({
          data: roles.map((role) => ({
            membershipId: membership.id,
            roleId: role.id,
            institutionId: context.institutionId,
          })),
        });
      }
      await transaction.auditEvent.create({
        data: {
          actorUserId: context.userId,
          institutionId: context.institutionId,
          eventType: 'admin.user.updated',
          entityType: 'InstitutionMembership',
          entityId: membership.id,
        },
      });
    });

    return this.getUser(token, membership.id);
  }

  async listRoles(token: string) {
    const context = await this.authService.requirePermission(
      token,
      'roles.view',
    );
    return this.prismaService.getClient().role.findMany({
      where: { institutionId: context.institutionId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createRole(token: string, input: CreateRoleInput) {
    const context = await this.authService.requirePermission(
      token,
      'roles.create',
    );
    this.ensureText(input.code, 'código de rol');
    this.ensureText(input.name, 'nombre de rol');
    const permissions = await this.resolvePermissions(input.permissionCodes);
    const role = await this.prismaService.getClient().role.create({
      data: {
        institutionId: context.institutionId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        permissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit(context, 'admin.role.created', 'Role', role.id);
    return role;
  }

  async updateRole(
    token: string,
    roleId: string,
    input: Partial<CreateRoleInput> & { isActive?: boolean },
  ) {
    const context = await this.authService.requirePermission(
      token,
      'roles.edit',
    );
    const prisma = this.prismaService.getClient();
    const role = await prisma.role.findFirst({
      where: { id: roleId, institutionId: context.institutionId },
    });
    if (!role) throw new NotFoundException('Rol no encontrado.');
    const permissions = input.permissionCodes
      ? await this.resolvePermissions(input.permissionCodes)
      : undefined;
    const updated = await prisma.$transaction(async (transaction) => {
      if (permissions) {
        await transaction.rolePermission.deleteMany({ where: { roleId } });
      }
      return transaction.role.update({
        where: { id: roleId },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(permissions
            ? {
                permissions: {
                  create: permissions.map((permission) => ({
                    permissionId: permission.id,
                  })),
                },
              }
            : {}),
        },
        include: { permissions: { include: { permission: true } } },
      });
    });
    await this.audit(context, 'admin.role.updated', 'Role', roleId);
    return updated;
  }

  async listPermissions(token: string) {
    await this.authService.requirePermission(token, 'permissions.view');
    return this.prismaService.getClient().permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async listAuditEvents(token: string) {
    const context = await this.authService.requirePermission(
      token,
      'audit.view',
    );
    return this.prismaService.getClient().auditEvent.findMany({
      where: context.isSuperAdministrator
        ? undefined
        : { institutionId: context.institutionId },
      include: {
        institution: { select: { code: true, name: true } },
        actorUser: { select: { email: true, documentNumber: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }

  async createPermission(token: string, resource: string, action: string) {
    const context = await this.authService.requirePermission(
      token,
      'permissions.create',
    );
    this.ensureText(resource, 'módulo');
    this.ensureText(action, 'acción');
    const permission = await this.prismaService.getClient().permission.create({
      data: { resource: resource.trim(), action: action.trim() },
    });
    await this.audit(
      context,
      'admin.permission.created',
      'Permission',
      permission.id,
    );
    return permission;
  }

  private async findMembership(
    membershipId: string,
    institutionId: string,
    isSuperAdministrator = false,
  ) {
    const membership = await this.prismaService
      .getClient()
      .institutionMembership.findFirst({
        where: isSuperAdministrator
          ? { id: membershipId }
          : { id: membershipId, institutionId },
        include: { user: true, userRoles: { include: { role: true } } },
      });
    if (!membership) throw new NotFoundException('Usuario no encontrado.');
    return membership;
  }

  private async resolveRoles(institutionId: string, roleCodes: string[]) {
    if (!roleCodes.length)
      throw new BadRequestException('Asigna al menos un rol.');
    const uniqueCodes = [
      ...new Set(roleCodes.map((code) => code.trim().toUpperCase())),
    ];
    const roles = await this.prismaService.getClient().role.findMany({
      where: { institutionId, code: { in: uniqueCodes }, isActive: true },
    });
    if (roles.length !== uniqueCodes.length) {
      throw new BadRequestException('Uno o más roles no son válidos.');
    }
    return roles;
  }

  private async resolvePermissions(permissionCodes: string[]) {
    const pairs = permissionCodes.map((code) => code.split('.', 2));
    if (pairs.some(([resource, action]) => !resource || !action)) {
      throw new BadRequestException(
        'Los permisos deben usar el formato módulo.acción.',
      );
    }
    const permissions = await this.prismaService
      .getClient()
      .permission.findMany({
        where: {
          OR: pairs.map(([resource, action]) => ({ resource, action })),
        },
      });
    if (permissions.length !== new Set(permissionCodes).size) {
      throw new BadRequestException('Uno o más permisos no son válidos.');
    }
    return permissions;
  }

  private userView(membership: {
    id: string;
    studentCode: string | null;
    isActive: boolean;
    user: {
      id: string;
      documentType: string | null;
      documentNumber: string | null;
      email: string | null;
      status: AccountStatus;
      mustChangePassword: boolean;
      isSuperAdministrator: boolean;
    };
    userRoles: Array<{ role: { code: string; name: string } }>;
  }) {
    return {
      membershipId: membership.id,
      studentCode: membership.studentCode,
      membershipActive: membership.isActive,
      user: membership.user,
      roles: membership.userRoles.map(({ role }) => ({
        code: role.code,
        name: role.name,
      })),
    };
  }

  private ensureText(value: string, label: string) {
    if (!value?.trim())
      throw new BadRequestException(`El campo ${label} es obligatorio.`);
  }

  private async audit(
    context: { userId: string; institutionId: string },
    eventType: string,
    entityType: string,
    entityId: string,
  ) {
    await this.prismaService.getClient().auditEvent.create({
      data: {
        actorUserId: context.userId,
        institutionId: context.institutionId,
        eventType,
        entityType,
        entityId,
      },
    });
  }
}
