import { HttpStatus } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('wraps listed users in a response model', async () => {
    const user = buildUser();
    const controller = new UsersController({
      findUsers: jest.fn(async () => [user]),
    } as unknown as UsersService);

    await expect(controller.findUsers()).resolves.toEqual({
      status: true,
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: [user],
      meta: undefined,
    });
  });

  it('wraps created users in a response model', async () => {
    const user = buildUser();
    const controller = new UsersController({
      createUser: jest.fn(async () => user),
    } as unknown as UsersService);

    await expect(
      controller.createUser({ email: 'ada@example.com' }),
    ).resolves.toEqual({
      status: true,
      statusCode: HttpStatus.CREATED,
      message: 'User created successfully',
      data: user,
      meta: undefined,
    });
  });
});

function buildUser(): User {
  return {
    id: '57619654-9af2-4e9d-b719-ab0d342dbb74',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    achievements: [],
    badges: [],
    purchases: [],
  };
}
