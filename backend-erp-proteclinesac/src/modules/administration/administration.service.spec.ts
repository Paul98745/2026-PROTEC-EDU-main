import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdministrationService } from './administration.service.js';

describe('User registration conflicts', () => {
  const input = {
    documentType: 'DNI',
    documentNumber: '12345678',
    email: 'test@example.com',
    roleCodes: ['ESTUDIANTE'],
  };
  function setup() {
    const user = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    const transaction = {
      user,
      institutionMembership: {
        create: vi.fn().mockResolvedValue({ id: 'membership' }),
      },
      userRole: { createMany: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const prisma = {
      user,
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role' }]) },
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const codes = { next: vi.fn().mockResolvedValue('D026100100') };
    const service = new AdministrationService(
      {
        requirePermission: vi
          .fn()
          .mockResolvedValue({ institutionId: 'institution', userId: 'actor' }),
      } as never,
      { getClient: () => prisma } as never,
      { hash: vi.fn().mockResolvedValue('hash') } as never,
      codes as never,
    );
    return { service, prisma, user, transaction, codes };
  }
  it('returns a document conflict before reserving a code or inserting data', async () => {
    const { service, user, codes, prisma } = setup();
    user.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.createUser('token', input)).rejects.toThrow(
      'tipo y número de documento',
    );
    expect(codes.next).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('returns an email conflict before inserting data', async () => {
    const { service, user, codes } = setup();
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    await expect(service.createUser('token', input)).rejects.toThrow(
      'correo electrónico',
    );
    expect(codes.next).not.toHaveBeenCalled();
  });
  it('handles duplicate identity races as HTTP 409', async () => {
    const { service, user } = setup();
    user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    const error = await service
      .createUser('token', input)
      .catch((error) => error);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(409);
  });
  it('preserves successful creation and unrelated errors', async () => {
    const { service, user, transaction } = setup();
    user.create.mockResolvedValue({ id: 'new-user' });
    vi.spyOn(service, 'getUser').mockResolvedValue({
      membershipId: 'membership',
    } as never);
    await expect(service.createUser('token', input)).resolves.toEqual({
      membershipId: 'membership',
    });
    expect(transaction.userRole.createMany).toHaveBeenCalled();
    const failure = new Error('connection unavailable');
    user.create.mockRejectedValue(failure);
    await expect(service.createUser('token', input)).rejects.toBe(failure);
  });
});
