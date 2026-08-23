import { Injectable } from '@nestjs/common';
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

@Injectable()
export class PaystackCashbackProvider implements CashbackProvider {
  readonly providerName = 'paystack';

  private readonly baseUrl: string;
  private readonly currency: string;
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
      return this.failed('Paystack secret key is not configured');
    }

    try {
      const user = await this.userRepository.findOne({
        where: { id: request.userId },
      });

      if (!user) {
        return this.failed('User was not found for cashback transfer');
      }

      const recipientCode = await this.resolveRecipientCode(user);

      const response = await fetch(`${this.baseUrl}/transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: this.source,
          amount: this.toMinorCurrencyUnit(request.amount),
          recipient: recipientCode,
          reference: this.formatReference(request.reference),
          reason: 'Badge cashback',
          currency: this.currency,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | PaystackTransferResponse
        | null;

      if (!response.ok || payload?.status !== true || !payload.data) {
        return this.failed(payload?.message ?? 'Paystack transfer was rejected');
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

      return this.failed(message);
    }
  }

  private async resolveRecipientCode(user: User): Promise<string> {
    if (user.payoutRecipientReference) {
      return user.payoutRecipientReference;
    }

    // recipient_code is Paystack-specific provider state, so it is created
    // lazily here instead of leaking into the provider-independent request.
    const recipientCode = await this.createTransferRecipient(user);
    await this.userRepository.update(
      { id: user.id },
      { payoutRecipientReference: recipientCode },
    );

    return recipientCode;
  }

  private async createTransferRecipient(user: User): Promise<string> {
    if (!user.accountNumber || !user.bankCode || !user.accountName) {
      throw new Error('User bank details are incomplete');
    }

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
        name: user.accountName,
        account_number: user.accountNumber,
        bank_code: user.bankCode,
        currency: user.currency ?? this.currency,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | PaystackTransferRecipientResponse
      | null;

    if (!response.ok || payload?.status !== true || !payload.data) {
      throw new Error(
        payload?.message ?? 'Paystack recipient creation was rejected',
      );
    }

    if (!payload.data.recipient_code) {
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
}
