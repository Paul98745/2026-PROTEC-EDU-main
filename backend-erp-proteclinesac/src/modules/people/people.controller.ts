import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { PeopleService } from './people.service.js';
import { maxFileSize } from './people.validation.js';
import type { Upload } from './people.validation.js';

function token(request: Request, config: ConfigService) {
  const name = config.get<string>('SESSION_COOKIE_NAME', 'protecedu_session');
  const value = request.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!value)
    throw new UnauthorizedException('No se encontró una sesión activa.');
  return value;
}

// Authenticate and authorize before the multipart interceptor buffers the file.
@Injectable()
export class PeopleGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const permission =
      request.method === 'GET'
        ? 'people.view'
        : context.getHandler().name === 'create'
          ? 'people.create'
          : 'people.edit';
    await this.auth.requirePermission(token(request, this.config), permission);
    return true;
  }
}

@Controller('people')
@UseGuards(PeopleGuard)
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly config: ConfigService,
  ) {}
  @Get()
  list(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.people.list(
      token(req, this.config),
      typeof search === 'string' ? search : '',
      typeof page === 'string' ? page : '1',
    );
  }
  @Get('accounts')
  accounts(@Req() req: Request) {
    return this.people.accounts(token(req, this.config));
  }
  @Get(':id')
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.people.get(token(req, this.config), id);
  }
  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    return this.people.save(token(req, this.config), null, body);
  }
  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.people.save(token(req, this.config), id, body);
  }
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: maxFileSize,
        files: 1,
        fields: 2,
        fieldSize: 1024,
        parts: 4,
      },
    }),
  )
  upload(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { kind: string; relativeId?: string },
    @UploadedFile() file?: Upload,
  ) {
    return this.people.upload(
      token(req, this.config),
      id,
      body.kind,
      body.relativeId,
      file,
    );
  }
  @Get(':id/documents/:documentId')
  async download(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const result = await this.people.download(
      token(req, this.config),
      id,
      documentId,
    );
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`,
    );
    res.send(result.buffer);
  }
  @Delete(':id/documents/:documentId')
  remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.people.removeDocument(token(req, this.config), id, documentId);
  }
}
