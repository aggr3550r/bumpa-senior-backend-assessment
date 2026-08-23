import {
  BadRequestException,
  Injectable,
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
      throw new ServiceUnavailableException(
        'Paystack secret key is not configured',
      );
    }

    const query = new URLSearchParams({
      account_number: input.accountNumber,
      bank_code: input.bankCode,
    });

    const response = await this.resolveAccount(query);
    const payload = (await response
      .json()
      .catch(() => null)) as PaystackResolveAccountResponse | null;

    if (
      !response.ok ||
      payload?.status !== true ||
      !payload.data?.account_name
    ) {
      throw new BadRequestException(
        payload?.message ?? 'Bank account could not be verified',
      );
    }

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

      throw new ServiceUnavailableException(message);
    }
  }
}
