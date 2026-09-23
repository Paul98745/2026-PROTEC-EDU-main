import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PeopleController, PeopleGuard } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PeopleController],
  providers: [PeopleService, PeopleGuard],
})
export class PeopleModule {}
