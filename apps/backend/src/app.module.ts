import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdministrationModule } from './modules/administration/administration.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { SecurityModule } from './shared/security/security.module.js';
import { PeopleModule } from './modules/people/people.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    SecurityModule,
    AuthModule,
    AdministrationModule,
    PeopleModule,
  ],
})
export class AppModule {}
