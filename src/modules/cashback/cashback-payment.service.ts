import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashbackPaymentStatus } from './types/cashback-payment-status.enum';
import {
  CreateCashbackPaymentInput,
  CreateCashbackPaymentResult,
  RecordCashbackProviderResultInput,
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

  async markCashbackAttemptStarted(
    paymentId: string,
    staleProcessingCutoff: Date,
  ): Promise<boolean> {
    /*
     * This update is the retry claim. It is intentionally conditional so
     * concurrent BadgeUnlocked deliveries cannot both send money for the same
     * failed entitlement: only one transaction can move the row into processing.
     * Processing rows are usually protected, but stale ones may be reclaimed
     * after a process crash because retries reuse the same provider reference.
     */
    const result = await this.cashbackPaymentRepository
      .createQueryBuilder()
      .update(CashbackPayment)
      .set({
        status: CashbackPaymentStatus.Processing,
        failureReason: null,
        attemptCount: () => '"attempt_count" + 1',
      })
      .where('id = :paymentId', { paymentId })
      .andWhere(
        `
          (
            status IN (:...claimableStatuses)
            OR (status = :processingStatus AND updated_at < :staleProcessingCutoff)
          )
        `,
        {
          claimableStatuses: [
            CashbackPaymentStatus.Pending,
            CashbackPaymentStatus.Failed,
          ],
          processingStatus: CashbackPaymentStatus.Processing,
          staleProcessingCutoff,
        },
      )
      .returning('id')
      .execute();

    return result.raw.length > 0;
  }

  async recordProviderResult(
    input: RecordCashbackProviderResultInput,
  ): Promise<void> {
    await this.cashbackPaymentRepository.update(
      { id: input.paymentId },
      {
        provider: input.provider,
        providerReference: input.providerReference ?? null,
        status: input.status,
        failureReason: input.failureReason ?? null,
      },
    );
  }

  private buildReference(userId: string, badgeId: string): string {
    return `cashback:${userId}:${badgeId}`;
  }
}
