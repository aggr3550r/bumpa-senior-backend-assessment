import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BANK_ACCOUNT_VERIFIER } from './types/bank-account-verifier.constants';
import { BankAccountVerifier } from './types/bank-account-verifier.types';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(BANK_ACCOUNT_VERIFIER)
    private readonly bankAccountVerifier: BankAccountVerifier,
  ) {}

  findUsers(): Promise<User[]> {
    this.logger.debug('Fetching users ordered by newest first');

    return this.userRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async createUser(input: CreateUserDto): Promise<User> {
    const email = input.email.trim().toLowerCase();
    this.logger.log(`Creating user: email=${email}`);

    const bankAccountDetails = this.validateBankAccountDetails(input);
    this.logger.debug(
      `Verifying bank account before user creation: email=${email}, bankCode=${bankAccountDetails.bankCode}, currency=${bankAccountDetails.currency}`,
    );

    const verifiedBankAccount =
      await this.bankAccountVerifier.verify(bankAccountDetails);
    this.logger.log(
      `Bank account verified for user creation: email=${email}, resolvedAccountName=${verifiedBankAccount.accountName}`,
    );

    // The verifier is the source of truth for the payout account name; firstName
    // and lastName remain the user's profile names and are intentionally untouched.
    const user = this.userRepository.create({
      email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      accountNumber: verifiedBankAccount.accountNumber,
      bankCode: verifiedBankAccount.bankCode,
      accountName: verifiedBankAccount.accountName,
      currency: verifiedBankAccount.currency,
      payoutRecipientReference: null,
    });

    try {
      const createdUser = await this.userRepository.save(user);

      this.logger.log(`User created: userId=${createdUser.id}, email=${email}`);

      return createdUser;
    } catch (error) {
      if (this.isUniqueViolation(error, 'UQ_users_email')) {
        this.logger.warn(`User creation rejected; email already exists: ${email}`);

        throw new ConflictException('email already exists');
      }

      throw error;
    }
  }

  private validateBankAccountDetails(
    input: CreateUserDto,
  ): Parameters<BankAccountVerifier['verify']>[0] {
    const details = input.bankAccountDetails;

    if (!details) {
      throw new BadRequestException('bankAccountDetails is required');
    }

    const accountNumber = details.accountNumber?.trim();
    const bankCode = details.bankCode?.trim();
    const currency = details.currency?.trim().toUpperCase();

    if (
      !accountNumber ||
      !bankCode ||
      !details.accountName?.trim() ||
      !currency
    ) {
      throw new BadRequestException(
        'bankAccountDetails accountNumber, bankCode, accountName, and currency are required',
      );
    }

    return {
      accountNumber,
      bankCode,
      currency,
    };
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
