import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordReset(email: string, token: string) {
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      return;
    }

    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const port = this.configService.getOrThrow<number>('SMTP_PORT');
    const user = this.configService.getOrThrow<string>('SMTP_USER');
    const password = this.configService.getOrThrow<string>('SMTP_PASSWORD');
    const from = this.configService.getOrThrow<string>('SMTP_FROM');
    const applicationUrl =
      this.configService.getOrThrow<string>('APP_PUBLIC_URL');
    const resetUrl = new URL('/restablecer', applicationUrl);
    resetUrl.searchParams.set('token', token);

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    await transport.sendMail({
      from,
      to: email,
      subject: 'Restablece tu contraseña de ProtecEdu',
      text: `Solicitaste restablecer tu contraseña. El enlace vence en 30 minutos: ${resetUrl.toString()}`,
    });
    this.logger.log(`Password-reset email sent to ${email}`);
  }
}
