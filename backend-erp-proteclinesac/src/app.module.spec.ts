import { Test } from '@nestjs/testing';
import { AccountStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { validateEnvironment } from './config/env.validation.js';
import { PrismaService } from './shared/database/prisma.service.js';

describe('AppModule', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('compiles without a database connection', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });

  it('accepts the approved account states', () => {
    expect(Object.values(AccountStatus)).toEqual([
      'ACTIVA',
      'INACTIVA',
      'BLOQUEADA',
    ]);
  });

  it('validates a PostgreSQL URL only when it is provided', () => {
    expect(validateEnvironment({ PORT: '3000' }).DATABASE_URL).toBeUndefined();
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'not-a-postgresql-url' }),
    ).toThrow('Invalid environment configuration');
  });

  it('does not create a database client until it is needed', () => {
    const configService = { get: () => undefined } as ConfigService;
    const service = new PrismaService(configService);

    expect(() => service.getClient()).toThrow(
      'DATABASE_URL is required to use the database client.',
    );
  });
});
