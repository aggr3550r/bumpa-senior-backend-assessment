import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CashbackProvider,
  CashbackProviderTransferStatus,
  SendCashbackRequest,
  SendCashbackResult,
} from '../../../modules/cashback/providers/cashback-provider.types';
import { User } from '../../../modules/users/entities/user.entity';

interface PaystackTransferResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    transfer_code?: string;
  };
}

interface PaystackTransferRecipientResponse {
  status?: boolean;
  message?: string;
  data?: {
    recipient_code?: string;
  };
}

const THIRD_PARTY_PAYOUT_RESTRICTION_MESSAGE =
  'You cannot initiate third party payouts at this time';

@Injectable()
export class PaystackCashbackProvider implements CashbackProvider {
  readonly providerName = 'paystack';

  private readonly logger = new Logger(PaystackCashbackProvider.name);
  private readonly baseUrl: string;
  private readonly currency: string;
  private readonly nodeEnv: string;
  private readonly secretKey: string;
  private readonly source: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.baseUrl = this.configService.get<string>(
      'PAYSTACK_BASE_URL',
      'https://api.paystack.co',
    );
    this.currency = this.configService.get<string>('PAYSTACK_CURRENCY', 'NGN');
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY', '');
    this.source = this.configService.get<string>(
      'PAYSTACK_TRANSFER_SOURCE',
      'balance',
    );
  }

  async sendCashback(
    request: SendCashbackRequest,
  ): Promise<SendCashbackResult> {
    if (!this.secretKey) {
      this.logger.error('Paystack cashback failed: secret key is not configured');

      return this.failed('Paystack secret key is not configured');
    }

    try {
      const formattedReference = this.formatReference(request.reference);
      const amountInMinorUnit = this.toMinorCurrencyUnit(request.amount);

      const user = await this.userRepository.findOne({
        where: { id: request.userId },
      });

      if (!user) {
        this.logger.error(
          `Paystack cashback failed: user not found for userId=${request.userId}`,
        );

        return this.failed('User was not found for cashback transfer');
      }

      const recipientCode = await this.resolveRecipientCode(user);
      this.logger.log(
        `Sending Paystack transfer: userId=${request.userId}, amount=${request.amount}, amountInMinorUnit=${amountInMinorUnit}, recipient=${recipientCode}, reference=${formattedReference}`,
      );

      const response = await fetch(`${this.baseUrl}/transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: this.source,
          amount: amountInMinorUnit,
          recipient: recipientCode,
          reference: formattedReference,
          reason: 'Badge cashback',
          currency: this.currency,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | PaystackTransferResponse
        | null;
      this.logger.log(
        `Paystack transfer response: httpStatus=${response.status}, ok=${response.ok}, payload=${this.serializePaystackTransferResponse(payload)}`,
      );

      if (!response.ok || payload?.status !== true || !payload.data) {
        const failureReason =
          payload?.message ?? 'Paystack transfer was rejected';

        if (this.shouldMockRestrictedPayout(failureReason)) {
          /*
           * Local development cannot always exercise real Paystack transfers:
           * unverified Paystack businesses are blocked from third-party payouts.
           * For demo/manual testing only, treat that exact restriction as a
           * successful provider response while keeping production/test behavior
           * tied to Paystack's real result.
           */
          this.logger.warn(
            `Mocking Paystack transfer success in development due to payout restriction: reference=${formattedReference}`,
          );

          return {
            provider: 'paystack',
            providerReference: `mock_${formattedReference}`,
            status: CashbackProviderTransferStatus.Succeeded,
            failureReason: null,
          };
        }

        this.logger.error(
          `Paystack transfer rejected: httpStatus=${response.status}, message=${failureReason}`,
        );

        return this.failed(failureReason);
      }

      return {
        provider: 'paystack',
        providerReference:
          payload.data.transfer_code ?? payload.data.reference ?? null,
        status: this.mapTransferStatus(payload.data.status),
        failureReason: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network failure';

      this.logger.error(
        `Paystack cashback failed before normalized response: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      return this.failed(message);
    }
  }

  private async resolveRecipientCode(user: User): Promise<string> {
    if (user.payoutRecipientReference) {
      this.logger.log(
        `Using stored Paystack recipient reference: userId=${user.id}, recipient=${user.payoutRecipientReference}`,
      );

      return user.payoutRecipientReference;
    }

    // recipient_code is Paystack-specific provider state, so it is created
    // lazily here instead of leaking into the provider-independent request.
    const recipientCode = await this.createTransferRecipient(user);
    await this.userRepository.update(
      { id: user.id },
      { payoutRecipientReference: recipientCode },
    );
    this.logger.log(
      `Stored Paystack recipient reference: userId=${user.id}, recipient=${recipientCode}`,
    );

    return recipientCode;
  }

  private async createTransferRecipient(input: {
    accountNumber?: string | null;
    bankCode?: string | null;
    accountName?: string | null;
    currency?: string | null;
  }): Promise<string> {
    if (!input.accountNumber || !input.bankCode || !input.accountName) {
      this.logger.error('Paystack recipient creation failed: incomplete user bank details');

      throw new Error('User bank details are incomplete');
    }

    this.logger.log(
      `Creating Paystack transfer recipient: bankCode=${input.bankCode}, accountNumber=${this.maskAccountNumber(input.accountNumber)}, accountName=${input.accountName}, currency=${input.currency ?? this.currency}`,
    );

    // Paystack returns an existing recipient for duplicate account details,
    // which keeps repeated cashback attempts from creating provider duplicates.
    const response = await fetch(`${this.baseUrl}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: input.accountName,
        account_number: input.accountNumber,
        bank_code: input.bankCode,
        currency: input.currency ?? this.currency,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | PaystackTransferRecipientResponse
      | null;
    this.logger.log(
      `Paystack recipient response: httpStatus=${response.status}, ok=${response.ok}, payload=${this.serializePaystackRecipientResponse(payload)}`,
    );

    if (!response.ok || payload?.status !== true || !payload.data) {
      this.logger.error(
        `Paystack recipient creation rejected: httpStatus=${response.status}, message=${payload?.message ?? 'Paystack recipient creation was rejected'}`,
      );

      throw new Error(
        payload?.message ?? 'Paystack recipient creation was rejected',
      );
    }

    if (!payload.data.recipient_code) {
      this.logger.error(
        'Paystack recipient creation failed: response did not include recipient_code',
      );

      throw new Error('Paystack recipient response did not include a code');
    }

    return payload.data.recipient_code;
  }

  private failed(failureReason: string): SendCashbackResult {
    return {
      provider: 'paystack',
      providerReference: null,
      status: CashbackProviderTransferStatus.Failed,
      failureReason,
    };
  }

  private formatReference(reference: string): string {
    return reference
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 50);
  }

  private mapTransferStatus(status?: string): CashbackProviderTransferStatus {
    if (status === 'success') {
      return CashbackProviderTransferStatus.Succeeded;
    }

    if (status === 'pending' || status === 'otp') {
      return CashbackProviderTransferStatus.Pending;
    }

    return CashbackProviderTransferStatus.Failed;
  }

  private toMinorCurrencyUnit(amount: number): number {
    return amount * 100;
  }

  private shouldMockRestrictedPayout(failureReason: string): boolean {
    return (
      this.nodeEnv === 'development' &&
      failureReason === THIRD_PARTY_PAYOUT_RESTRICTION_MESSAGE
    );
  }

  private maskAccountNumber(accountNumber: string): string {
    return accountNumber.replace(/\d(?=\d{4})/g, '*');
  }

  private serializePaystackRecipientResponse(
    payload: PaystackTransferRecipientResponse | null,
  ): string {
    return JSON.stringify({
      status: payload?.status,
      message: payload?.message,
      recipientCode: payload?.data?.recipient_code,
    });
  }

  private serializePaystackTransferResponse(
    payload: PaystackTransferResponse | null,
  ): string {
    return JSON.stringify({
      status: payload?.status,
      message: payload?.message,
      data: payload?.data
        ? {
            reference: payload.data.reference,
            status: payload.data.status,
            transferCode: payload.data.transfer_code,
          }
        : undefined,
    });
  }
}
