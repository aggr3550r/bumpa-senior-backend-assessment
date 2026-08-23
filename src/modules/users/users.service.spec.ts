import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

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
    const { service, repository } = createServiceHarness();

    await service.createUser({
      email: ' ADA@EXAMPLE.COM ',
      firstName: 'Ada',
      lastName: 'Customer',
    });

    expect(repository.savedUser).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Customer',
    });
  });

  it('rejects blank emails', async () => {
    const { service } = createServiceHarness();

    await expect(service.createUser({ email: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns a conflict when email already exists', async () => {
    const { service, repository } = createServiceHarness();
    repository.saveError = buildUniqueEmailViolation();

    await expect(
      service.createUser({ email: 'ada@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not swallow unexpected persistence errors', async () => {
    const { service, repository } = createServiceHarness();
    repository.saveError = new Error('database unavailable');

    await expect(
      service.createUser({ email: 'ada@example.com' }),
    ).rejects.toThrow('database unavailable');
  });
});

function createServiceHarness() {
  const repository = new FakeUserRepository();

  return {
    repository,
    service: new UsersService(repository as never),
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
