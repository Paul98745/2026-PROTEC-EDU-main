import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class InstitutionalCodeService {
  constructor(private readonly prismaService: PrismaService) {}

  async next(institutionId: string, year: number, period: number) {
    if (!Number.isInteger(year) || year < 1000 || year > 2999) {
      throw new BadRequestException('El año académico no es válido.');
    }
    if (!Number.isInteger(period) || period < 1 || period > 9) {
      throw new BadRequestException(
        'El período académico debe estar entre 1 y 9.',
      );
    }
    const prisma = this.prismaService.getClient();
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { codePrefix: true },
    });
    if (!institution)
      throw new BadRequestException('Institución no encontrada.');

    const rows = await prisma.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "institutional_code_sequences"
        ("id", "institutionId", "academicYear", "period", "lastValue", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${institutionId}::uuid, ${year}, ${period}, 1, NOW(), NOW())
      ON CONFLICT ("institutionId", "academicYear", "period")
      DO UPDATE SET "lastValue" = "institutional_code_sequences"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue";
    `;
    const sequence = rows[0]?.lastValue;
    if (!sequence)
      throw new Error('No fue posible reservar la secuencia institucional.');

    return `${institution.codePrefix}${String(year).slice(-3)}${period}${String(sequence).padStart(5, '0')}`;
  }
}
