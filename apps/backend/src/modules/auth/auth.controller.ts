import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AuthThrottleService } from '../../shared/security/auth-throttle.service.js';

type LoginBody = {
  institutionCode?: string;
  studentCode?: string;
  password?: string;
};

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

type ResetRequestBody = {
  institutionCode?: string;
  studentCode?: string;
};

type ResetPasswordBody = {
  token?: string;
  newPassword?: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly authThrottleService: AuthThrottleService,
  ) {}

  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authThrottleService.check('login', request.ip);
    const institutionCode = requiredText(body.institutionCode, 'institución');
    const studentCode = requiredText(body.studentCode, 'código institucional');
    const password = requiredText(body.password, 'contraseña');
    const result = await this.authService.login(
      institutionCode,
      studentCode,
      password,
      requestMetadata(request),
    );

    response.cookie(
      this.cookieName,
      result.token,
      this.cookieOptions(result.expiresAt),
    );
    return { user: result.user };
  }

  @Get('me')
  async me(@Req() request: Request) {
    return this.authService.getCurrentUser(this.readSessionToken(request));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authThrottleService.check('password-reset', request.ip);
    await this.authService.logout(
      this.readOptionalSessionToken(request),
      requestMetadata(request),
    );
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @Body() body: ChangePasswordBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.changePassword(
      this.readSessionToken(request),
      requiredText(body.currentPassword, 'contraseña actual'),
      requiredText(body.newPassword, 'nueva contraseña'),
      requestMetadata(request),
    );
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  @Post('password-reset/request')
  async requestPasswordReset(
    @Body() body: ResetRequestBody,
    @Req() request: Request,
  ) {
    const result = await this.authService.requestPasswordReset(
      requiredText(body.institutionCode, 'institución'),
      requiredText(body.studentCode, 'código institucional'),
      requestMetadata(request),
    );

    return {
      message:
        'Si los datos corresponden a una cuenta con correo, recibirás instrucciones para restablecer tu contraseña.',
      ...result,
    };
  }

  @Post('password-reset/complete')
  @HttpCode(204)
  async resetPassword(
    @Body() body: ResetPasswordBody,
    @Req() request: Request,
  ) {
    await this.authService.resetPassword(
      requiredText(body.token, 'enlace de recuperación'),
      requiredText(body.newPassword, 'nueva contraseña'),
      requestMetadata(request),
    );
  }

  private get cookieName() {
    return this.configService.get<string>(
      'SESSION_COOKIE_NAME',
      'protecedu_session',
    );
  }

  private cookieOptions(expires?: Date) {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      path: '/',
      ...(expires ? { expires } : {}),
    };
  }

  private readSessionToken(request: Request) {
    const token = this.readOptionalSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('No se encontró una sesión activa.');
    }
    return token;
  }

  private readOptionalSessionToken(request: Request) {
    return request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${this.cookieName}=`))
      ?.slice(this.cookieName.length + 1);
  }
}

function requiredText(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new BadRequestException(`El campo ${label} es obligatorio.`);
  }
  return value.trim();
}

function requestMetadata(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
