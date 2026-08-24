import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  it('lists users with newest users first', async () => {
    const { service, repository } = createServiceHarness();

    await service.findUsers();

    expect(repository.findOptions).toEqual({
      order: {
        createdAt: 'DESC',
      },
    });
  });

  it('normalizes email before creating a user', async () => {
    const { service, repository, bankAccountVerifier } = createServiceHarness();

    await service.createUser(buildCreateUserInput());

    expect(bankAccountVerifier.verifyInput).toEqual({
      accountNumber: '0123456789',
      bankCode: '044',
      currency: 'NGN',
    });
    expect(repository.savedUser).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Customer',
      accountNumber: '0123456789',
      bankCode: '044',
      accountName: 'ADA CUSTOMER',
      currency: 'NGN',
      payoutRecipientReference: null,
    });
  });

  it('requires complete bank account details', async () => {
    const { service } = createServiceHarness();

    await expect(
      service.createUser({
        ...buildCreateUserInput(),
        bankAccountDetails: {
          accountNumber: '0123456789',
          bankCode: '',
          accountName: 'Ada Customer',
          currency: 'NGN',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a conflict when email already exists', async () => {
    const { service, repository } = createServiceHarness();
    repository.saveError = buildUniqueEmailViolation();

    await expect(
      service.createUser(buildCreateUserInput()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not swallow unexpected persistence errors', async () => {
    const { service, repository } = createServiceHarness();
    repository.saveError = new Error('database unavailable');

    await expect(
      service.createUser(buildCreateUserInput()),
    ).rejects.toThrow('database unavailable');
  });
});

function createServiceHarness() {
  const repository = new FakeUserRepository();
  const bankAccountVerifier = new FakeBankAccountVerifier();

  return {
    repository,
    bankAccountVerifier,
    service: new UsersService(repository as never, bankAccountVerifier as never),
  };
}

function buildCreateUserInput() {
  return {
    email: ' ADA@EXAMPLE.COM ',
    firstName: 'Ada',
    lastName: 'Customer',
    bankAccountDetails: {
      accountNumber: '0123456789',
      bankCode: '044',
      accountName: 'Customer Supplied Name',
      currency: 'ngn',
    },
  };
}

function buildUniqueEmailViolation() {
  return new QueryFailedError('insert user', [], {
    code: '23505',
    constraint: 'UQ_users_email',
  } as unknown as Error);
}

class FakeUserRepository {
  findOptions?: unknown;
  saveError?: Error;
  savedUser?: User;

  async find(options: unknown): Promise<User[]> {
    this.findOptions = options;

    return [];
  }

  create(payload: Partial<User>): User {
    return payload as User;
  }

  async save(user: User): Promise<User> {
    if (this.saveError) {
      throw this.saveError;
    }

    this.savedUser = user;

    return user;
  }
}

class FakeBankAccountVerifier {
  verifyInput?: unknown;

  async verify(input: {
    accountNumber: string;
    bankCode: string;
    currency: string;
  }) {
    this.verifyInput = input;

    return {
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      accountName: 'ADA CUSTOMER',
      currency: input.currency,
    };
  }
}
