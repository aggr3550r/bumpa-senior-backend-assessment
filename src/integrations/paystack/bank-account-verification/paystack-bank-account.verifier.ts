import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankAccountVerifier,
  VerifiedBankAccount,
  VerifyBankAccountInput,
} from '../../../modules/users/types/bank-account-verifier.types';

interface PaystackResolveAccountResponse {
  status?: boolean;
  message?: string;
  data?: {
    account_number?: string;
    account_name?: string;
  };
}

@Injectable()
export class PaystackBankAccountVerifier implements BankAccountVerifier {
  private readonly logger = new Logger(PaystackBankAccountVerifier.name);

  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'PAYSTACK_BASE_URL',
      'https://api.paystack.co',
    );
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY', '');
  }

  async verify(input: VerifyBankAccountInput): Promise<VerifiedBankAccount> {
    if (!this.secretKey) {
      this.logger.error(
        'Paystack bank verification failed: secret key is not configured',
      );

      throw new ServiceUnavailableException(
        'Paystack secret key is not configured',
      );
    }

    this.logger.log(
      `Verifying bank account with Paystack: bankCode=${input.bankCode}, accountNumber=${this.maskAccountNumber(input.accountNumber)}, currency=${input.currency}`,
    );

    const query = new URLSearchParams({
      account_number: input.accountNumber,
      bank_code: input.bankCode,
    });

    const response = await this.resolveAccount(query);
    const payload = (await response
      .json()
      .catch(() => null)) as PaystackResolveAccountResponse | null;
    this.logger.log(
      `Paystack bank verification response: httpStatus=${response.status}, ok=${response.ok}, status=${payload?.status ?? 'null'}, message=${payload?.message ?? 'null'}`,
    );

    if (
      !response.ok ||
      payload?.status !== true ||
      !payload.data?.account_name
    ) {
      this.logger.warn(
        `Paystack bank verification rejected: bankCode=${input.bankCode}, accountNumber=${this.maskAccountNumber(input.accountNumber)}, message=${payload?.message ?? 'Bank account could not be verified'}`,
      );

      throw new BadRequestException(
        payload?.message ?? 'Bank account could not be verified',
      );
    }

    this.logger.log(
      `Paystack bank verification succeeded: bankCode=${input.bankCode}, accountNumber=${this.maskAccountNumber(payload.data.account_number ?? input.accountNumber)}, resolvedAccountName=${payload.data.account_name}`,
    );

    return {
      accountNumber: payload.data.account_number ?? input.accountNumber,
      bankCode: input.bankCode,
      accountName: payload.data.account_name,
      currency: input.currency,
    };
  }

  private async resolveAccount(query: URLSearchParams): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/bank/resolve?${query}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Paystack bank verification is unavailable';

      this.logger.error(
        `Paystack bank verification network failure: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(message);
    }
  }

  private maskAccountNumber(accountNumber: string): string {
    return accountNumber.replace(/\d(?=\d{4})/g, '*');
  }
}
