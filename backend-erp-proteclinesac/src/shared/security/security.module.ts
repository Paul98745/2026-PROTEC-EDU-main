import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';
import { InstitutionalCodeService } from './institutional-code.service.js';
import { MailService } from './mail.service.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  providers: [
    PasswordService,
    TokenService,
    InstitutionalCodeService,
    MailService,
    AuthThrottleService,
  ],
  exports: [
    PasswordService,
    TokenService,
    InstitutionalCodeService,
    MailService,
    AuthThrottleService,
  ],
})
export class SecurityModule {}
