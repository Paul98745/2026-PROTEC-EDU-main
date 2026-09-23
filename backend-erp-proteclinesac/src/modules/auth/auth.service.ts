import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { PasswordService } from '../../shared/security/password.service.js';
import { TokenService } from '../../shared/security/token.service.js';
import { MailService } from '../../shared/security/mail.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const RESET_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

type RequestMetadata = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async login(
    institutionCode: string,
    studentCode: string,
    password: string,
    metadata: RequestMetadata,
  ) {
    const prisma = this.prismaService.getClient();
    const membership = await prisma.institutionMembership.findFirst({
      where: {
        studentCode: studentCode.trim(),
        isActive: true,
        institution: { code: institutionCode.trim(), isActive: true },
      },
      include: { institution: true, user: true },
    });

    const invalidCredentials = () =>
      new UnauthorizedException(
        'No fue posible iniciar sesión con esas credenciales.',
      );

    if (!membership) {
      await this.audit('auth.login.failed', undefined, undefined, metadata);
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwordService.verify(
      password,
      membership.user.passwordHash,
    );
    const user = membership.user;

    if (!passwordMatches) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const locked = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts,
            ...(locked
              ? { status: AccountStatus.BLOQUEADA, lockedAt: new Date() }
              : {}),
          },
        }),
        prisma.auditEvent.create({
          data: {
            actorUserId: user.id,
            institutionId: membership.institutionId,
            eventType: locked ? 'auth.login.locked' : 'auth.login.failed',
            entityType: 'User',
            entityId: user.id,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
          },
        }),
      ]);
      throw invalidCredentials();
    }

    if (user.status !== AccountStatus.ACTIVA) {
      await this.audit(
        'auth.login.rejected',
        user.id,
        membership.institutionId,
        metadata,
      );
      throw invalidCredentials();
    }

    const token = this.tokenService.create();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedAt: null },
      }),
      prisma.session.create({
        data: {
          userId: user.id,
          institutionId: membership.institutionId,
          tokenHash: this.tokenService.hash(token),
          expiresAt,
        },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          institutionId: membership.institutionId,
          eventType: 'auth.login.succeeded',
          entityType: 'User',
          entityId: user.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    return {
      token,
      expiresAt,
      user: await this.getCurrentUser(token),
    };
  }

  async getCurrentUser(token: string) {
    const { session, membership } = await this.requireSession(token);
    const { permissions, roles } = this.collectAuthorization(membership);

    return {
      id: session.user.id,
      institution: {
        code: session.institution.code,
        name: session.institution.name,
      },
      studentCode: membership.studentCode,
      roles,
      permissions,
      isSuperAdministrator: session.user.isSuperAdministrator,
      mustChangePassword: session.user.mustChangePassword,
    };
  }

  async requirePermission(token: string, permission: string) {
    const { session, membership } = await this.requireSession(token);
    const { permissions } = this.collectAuthorization(membership);

    if (
      !session.user.isSuperAdministrator &&
      !permissions.includes(permission)
    ) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción.',
      );
    }

    return {
      userId: session.userId,
      institutionId: session.institutionId,
      permissions,
      isSuperAdministrator: session.user.isSuperAdministrator,
    };
  }

  async logout(token: string | undefined, metadata: RequestMetadata) {
    if (!token) {
      return;
    }

    const prisma = this.prismaService.getClient();
    const session = await prisma.session.findUnique({
      where: { tokenHash: this.tokenService.hash(token) },
    });

    if (!session || session.revokedAt) {
      return;
    }

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: session.userId,
          institutionId: session.institutionId,
          eventType: 'auth.logout',
          entityType: 'Session',
          entityId: session.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
  }

  async changePassword(
    token: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ) {
    if (!this.passwordService.isStrong(newPassword)) {
      throw new BadRequestException(
        'La nueva contraseña no cumple la política de seguridad.',
      );
    }

    const { session } = await this.requireSession(token);
    const currentPasswordMatches = await this.passwordService.verify(
      currentPassword,
      session.user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException('No fue posible cambiar la contraseña.');
    }

    const prisma = this.prismaService.getClient();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: {
          passwordHash: await this.passwordService.hash(newPassword),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedAt: null,
        },
      }),
      prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: session.userId,
          institutionId: session.institutionId,
          eventType: 'auth.password.changed',
          entityType: 'User',
          entityId: session.userId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
  }

  async requestPasswordReset(
    institutionCode: string,
    studentCode: string,
    metadata: RequestMetadata,
  ) {
    const prisma = this.prismaService.getClient();
    const membership = await prisma.institutionMembership.findFirst({
      where: {
        studentCode: studentCode.trim(),
        institution: { code: institutionCode.trim() },
      },
      include: { user: true },
    });

    if (
      !membership ||
      membership.user.status !== AccountStatus.ACTIVA ||
      !membership.user.email
    ) {
      await this.audit(
        'auth.password-reset.requested',
        undefined,
        undefined,
        metadata,
      );
      return {};
    }

    const token = this.tokenService.create();
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: membership.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: membership.userId,
          tokenHash: this.tokenService.hash(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_MAX_AGE_MS),
        },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: membership.userId,
          institutionId: membership.institutionId,
          eventType: 'auth.password-reset.requested',
          entityType: 'User',
          entityId: membership.userId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    try {
      await this.mailService.sendPasswordReset(membership.user.email, token);
    } catch {
      await this.audit(
        'auth.password-reset.delivery-failed',
        membership.userId,
        membership.institutionId,
        metadata,
      );
      return {};
    }

    return this.configService.get<string>('NODE_ENV') === 'development'
      ? { developmentToken: token }
      : {};
  }

  async resetPassword(
    token: string,
    newPassword: string,
    metadata: RequestMetadata,
  ) {
    if (!this.passwordService.isStrong(newPassword)) {
      throw new BadRequestException(
        'La nueva contraseña no cumple la política de seguridad.',
      );
    }

    const prisma = this.prismaService.getClient();
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokenService.hash(token) },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      throw new BadRequestException('El enlace no es válido o venció.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: await this.passwordService.hash(newPassword),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedAt: null,
          status: AccountStatus.ACTIVA,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: resetToken.userId,
          eventType: 'auth.password-reset.completed',
          entityType: 'User',
          entityId: resetToken.userId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
  }

  private async requireSession(token: string) {
    const prisma = this.prismaService.getClient();
    const session = await prisma.session.findUnique({
      where: { tokenHash: this.tokenService.hash(token) },
      include: { user: true, institution: true },
    });

    const now = new Date();
    const isExpired =
      !session ||
      !!session.revokedAt ||
      session.expiresAt <= now ||
      session.lastActivityAt.getTime() + SESSION_IDLE_TIMEOUT_MS <=
        now.getTime();

    if (isExpired) {
      if (session && !session.revokedAt) {
        await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: now },
        });
      }
      throw new UnauthorizedException('La sesión no es válida o ha vencido.');
    }

    if (session.user.status !== AccountStatus.ACTIVA) {
      throw new UnauthorizedException('La sesión no es válida o ha vencido.');
    }

    const membership = await prisma.institutionMembership.findUnique({
      where: {
        userId_institutionId: {
          userId: session.userId,
          institutionId: session.institutionId,
        },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!membership?.isActive || !session.institution.isActive) {
      throw new UnauthorizedException('La sesión no es válida o ha vencido.');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });

    return { session, membership };
  }

  private async audit(
    eventType: string,
    actorUserId: string | undefined,
    institutionId: string | undefined,
    metadata: RequestMetadata,
  ) {
    await this.prismaService.getClient().auditEvent.create({
      data: {
        eventType,
        actorUserId,
        institutionId,
        entityType: actorUserId ? 'User' : undefined,
        entityId: actorUserId,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
  }

  private collectAuthorization(membership: {
    userRoles: Array<{
      role: {
        code: string;
        permissions: Array<{
          permission: { resource: string; action: string };
        }>;
      };
    }>;
  }) {
    const permissions = new Set<string>();
    const roles = membership.userRoles.map(({ role }) => {
      for (const { permission } of role.permissions) {
        permissions.add(`${permission.resource}.${permission.action}`);
      }
      return role.code;
    });

    return { permissions: [...permissions].sort(), roles };
  }
}
