import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashbackPaymentStatus } from './types/cashback-payment-status.enum';
import {
  CreateCashbackPaymentInput,
  CreateCashbackPaymentResult,
} from './types/cashback-payment.types';
import { CashbackPayment } from './entities/cashback-payment.entity';

@Injectable()
export class CashbackPaymentService {
  constructor(
    @InjectRepository(CashbackPayment)
    private readonly cashbackPaymentRepository: Repository<CashbackPayment>,
  ) {}

  async createPendingCashbackPayment(
    input: CreateCashbackPaymentInput,
  ): Promise<CreateCashbackPaymentResult> {
    const reference = this.buildReference(input.userId, input.badgeId);

    /*
     * This creates the cashback entitlement only; no external provider is
     * called here. The unique user/badge key makes duplicate BadgeUnlocked
     * handling harmless, while the persisted reference becomes the provider
     * idempotency key for the later transfer step.
     */
    const insertResult = await this.cashbackPaymentRepository
      .createQueryBuilder()
      .insert()
      .values({
        userId: input.userId,
        badgeId: input.badgeId,
        amount: input.amount,
        provider: input.provider,
        reference,
        status: CashbackPaymentStatus.Pending,
        attemptCount: 0,
      })
      .orIgnore()
      .returning('id')
      .execute();

    const payment = await this.cashbackPaymentRepository.findOneOrFail({
      where: {
        userId: input.userId,
        badgeId: input.badgeId,
      },
    });

    return {
      payment,
      created: insertResult.raw.length > 0,
    };
  }

  private buildReference(userId: string, badgeId: string): string {
    return `cashback:${userId}:${badgeId}`;
  }
}
