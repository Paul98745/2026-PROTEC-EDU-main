import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AccountStatus } from '@prisma/client';
import { AdministrationService } from './administration.service.js';

type UserBody = {
  documentType?: string;
  documentNumber?: string;
  academicPeriod?: number;
  email?: string | null;
  status?: AccountStatus;
  roleCodes?: string[];
};

type RoleBody = {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  permissionCodes?: string[];
};

@Controller('admin')
export class AdministrationController {
  constructor(
    private readonly administrationService: AdministrationService,
    private readonly configService: ConfigService,
  ) {}

  @Get('users')
  listUsers(@Req() request: Request) {
    return this.administrationService.listUsers(this.token(request));
  }

  @Get('users/:membershipId')
  getUser(
    @Req() request: Request,
    @Param('membershipId') membershipId: string,
  ) {
    return this.administrationService.getUser(
      this.token(request),
      membershipId,
    );
  }

  @Post('users')
  createUser(@Req() request: Request, @Body() body: UserBody) {
    if (!body.documentType || !body.documentNumber || !body.roleCodes) {
      throw new BadRequestException(
        'Faltan datos obligatorios para crear el usuario.',
      );
    }
    return this.administrationService.createUser(this.token(request), {
      documentType: body.documentType,
      documentNumber: body.documentNumber,
      academicPeriod: body.academicPeriod,
      email: body.email ?? undefined,
      status: body.status,
      roleCodes: body.roleCodes,
    });
  }

  @Patch('users/:membershipId')
  updateUser(
    @Req() request: Request,
    @Param('membershipId') membershipId: string,
    @Body() body: UserBody,
  ) {
    return this.administrationService.updateUser(
      this.token(request),
      membershipId,
      {
        email: body.email,
        status: body.status,
        roleCodes: body.roleCodes,
      },
    );
  }

  @Get('roles')
  listRoles(@Req() request: Request) {
    return this.administrationService.listRoles(this.token(request));
  }

  @Post('roles')
  createRole(@Req() request: Request, @Body() body: RoleBody) {
    if (!body.code || !body.name || !body.permissionCodes) {
      throw new BadRequestException(
        'Faltan datos obligatorios para crear el rol.',
      );
    }
    return this.administrationService.createRole(this.token(request), {
      code: body.code,
      name: body.name,
      description: body.description,
      permissionCodes: body.permissionCodes,
    });
  }

  @Patch('roles/:roleId')
  updateRole(
    @Req() request: Request,
    @Param('roleId') roleId: string,
    @Body() body: RoleBody,
  ) {
    return this.administrationService.updateRole(
      this.token(request),
      roleId,
      body,
    );
  }

  @Get('permissions')
  listPermissions(@Req() request: Request) {
    return this.administrationService.listPermissions(this.token(request));
  }

  @Post('permissions')
  createPermission(
    @Req() request: Request,
    @Body() body: { resource?: string; action?: string },
  ) {
    if (!body.resource || !body.action) {
      throw new BadRequestException('Módulo y acción son obligatorios.');
    }
    return this.administrationService.createPermission(
      this.token(request),
      body.resource,
      body.action,
    );
  }

  @Get('audit')
  listAuditEvents(@Req() request: Request) {
    return this.administrationService.listAuditEvents(this.token(request));
  }

  private token(request: Request) {
    const cookieName = this.configService.get<string>(
      'SESSION_COOKIE_NAME',
      'protecedu_session',
    );
    const token = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);

    if (!token)
      throw new UnauthorizedException('No se encontró una sesión activa.');
    return token;
  }
}
