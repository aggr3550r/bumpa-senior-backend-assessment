import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(CashbackPaymentService.name);

  constructor(
    @InjectRepository(CashbackPayment)
    private readonly cashbackPaymentRepository: Repository<CashbackPayment>,
  ) {}

  async createPendingCashbackPayment(
    input: CreateCashbackPaymentInput,
  ): Promise<CreateCashbackPaymentResult> {
    const reference = this.buildReference(input.userId, input.badgeId);
    this.logger.debug(
      `Resolving cashback entitlement: userId=${input.userId}, badgeId=${input.badgeId}, amount=${input.amount}, provider=${input.provider}, reference=${reference}`,
    );

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
    const created = insertResult.raw.length > 0;

    this.logger.log(
      `Cashback entitlement ${created ? 'created' : 'reused'}: paymentId=${payment.id}, userId=${input.userId}, badgeId=${input.badgeId}, status=${payment.status}, reference=${payment.reference}`,
    );

    return {
      payment,
      created,
    };
  }

  async markCashbackAttemptStarted(
    paymentId: string,
    staleProcessingCutoff: Date,
  ): Promise<boolean> {
    /*
     * The conditional update is the worker claim. A unique cashback row
     * prevents duplicate entitlements; this claim prevents two workers from
     * sending the same non-terminal entitlement at the same time.
     */
    const updateResult = await this.cashbackPaymentRepository
      .createQueryBuilder()
      .update(CashbackPayment)
      .set({
        status: CashbackPaymentStatus.Processing,
        failureReason: null,
        attemptCount: () => '"attempt_count" + 1',
      })
      .where('id = :paymentId', { paymentId })
      .andWhere(
        '(status IN (:...claimableStatuses) OR (status = :processingStatus AND updated_at <= :staleProcessingCutoff))',
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

    const claimed = updateResult.raw.length > 0;
    this.logger.log(
      `Cashback attempt claim ${claimed ? 'succeeded' : 'skipped'}: paymentId=${paymentId}`,
    );

    return claimed;
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

    this.logger.log(
      `Cashback provider result persisted: paymentId=${input.paymentId}, provider=${input.provider}, status=${input.status}, providerReference=${input.providerReference ?? 'null'}, failureReason=${input.failureReason ?? 'null'}`,
    );
  }

  private buildReference(userId: string, badgeId: string): string {
    return `cashback:${userId}:${badgeId}`;
  }
}
