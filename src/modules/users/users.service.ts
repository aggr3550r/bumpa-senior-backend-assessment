import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findUsers(): Promise<User[]> {
    return this.userRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async createUser(input: CreateUserDto): Promise<User> {
    if (!input.email?.trim()) {
      throw new BadRequestException('email is required');
    }

    const user = this.userRepository.create({
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (this.isUniqueViolation(error, 'UQ_users_email')) {
        throw new ConflictException('email already exists');
      }

      throw error;
    }
  }

  private isUniqueViolation(error: unknown, constraint: string): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string; constraint?: string }).code ===
        '23505' &&
      (error.driverError as { code?: string; constraint?: string })
        .constraint === constraint
    );
  }
}
