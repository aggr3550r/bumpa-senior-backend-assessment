import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { CASHBACK_PROVIDER } from '../../modules/cashback/providers/cashback-provider.constants';
import {
  CashbackProvider,
  SendCashbackResult,
  CashbackProviderTransferStatus,
} from '../../modules/cashback/providers/cashback-provider.types';
import { CashbackPaymentService } from '../../modules/cashback/cashback-payment.service';
import { CashbackPaymentStatus } from '../../modules/cashback/types/cashback-payment-status.enum';
import {
  BADGE_UNLOCKED_OUTBOX_EVENT,
  BadgeUnlockedOutboxPayload,
} from '../../outbox/outbox-event.types';
import { BADGE_EVENTS_QUEUE } from '../domain-queue.constants';

const BADGE_CASHBACK_AMOUNT = 300;

@Injectable()
@Processor(BADGE_EVENTS_QUEUE)
export class BadgeUnlockedCashbackProcessor extends WorkerHost {
  private readonly logger = new Logger(BadgeUnlockedCashbackProcessor.name);

  constructor(
    private readonly cashbackPayments: CashbackPaymentService,
    private readonly configService: ConfigService,
    @Inject(CASHBACK_PROVIDER)
    private readonly cashbackProvider: CashbackProvider,
  ) {
    super();
  }

  async process(job: Job<BadgeUnlockedOutboxPayload>): Promise<void> {
    if (job.name !== BADGE_UNLOCKED_OUTBOX_EVENT) {
      throw new Error(`Unsupported badge event job: ${job.name}`);
    }

    const event = job.data;
    this.logger.log(
      `Processing cashback for badge unlock: userId=${event.userId}, badgeId=${event.badgeId}, badgeName=${event.badgeName}`,
    );

    /*
     * BullMQ is at-least-once. This consumer is idempotent because the
     * persisted cashback row is unique per user/badge and successful payments
     * are never sent again.
     */
    const { payment, created } =
      await this.cashbackPayments.createPendingCashbackPayment({
        userId: event.userId,
        badgeId: event.badgeId,
        amount: BADGE_CASHBACK_AMOUNT,
        provider: this.cashbackProvider.providerName,
      });

    if (payment.status === CashbackPaymentStatus.Succeeded) {
      this.logger.log(
        `Skipping cashback because payment already succeeded: paymentId=${payment.id}`,
      );

      return;
    }

    if (
      !created &&
      ![
        CashbackPaymentStatus.Failed,
        CashbackPaymentStatus.Processing,
      ].includes(payment.status)
    ) {
      this.logger.log(
        `Skipping duplicate cashback job while payment is ${payment.status}: paymentId=${payment.id}`,
      );

      return;
    }

    const claimedAttempt =
      await this.cashbackPayments.markCashbackAttemptStarted(
        payment.id,
        this.getStaleProcessingCutoff(),
      );

    if (!claimedAttempt) {
      this.logger.log(
        `Skipping cashback because another worker already claimed this attempt: paymentId=${payment.id}`,
      );

      return;
    }

    try {
      const result = await this.cashbackProvider.sendCashback({
        userId: event.userId,
        amount: BADGE_CASHBACK_AMOUNT,
        reference: payment.reference,
      });

      await this.recordProviderResult(payment.id, result);
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Cashback provider failed';

      this.logger.error(
        `Cashback provider threw before returning a normalized result: paymentId=${payment.id}, failureReason=${failureReason}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.cashbackPayments.recordProviderResult({
        paymentId: payment.id,
        provider: this.cashbackProvider.providerName,
        providerReference: null,
        status: CashbackPaymentStatus.Failed,
        failureReason,
      });
    }
  }

  private async recordProviderResult(
    paymentId: string,
    result: SendCashbackResult,
  ): Promise<void> {
    const paymentStatus = this.toPaymentStatus(result.status);

    this.logger.log(
      `Cashback provider result: paymentId=${paymentId}, provider=${result.provider}, providerStatus=${result.status}, paymentStatus=${paymentStatus}, providerReference=${result.providerReference ?? 'null'}, failureReason=${result.failureReason ?? 'null'}`,
    );

    await this.cashbackPayments.recordProviderResult({
      paymentId,
      provider: result.provider,
      providerReference: result.providerReference,
      status: paymentStatus,
      failureReason: result.failureReason,
    });
  }

  private toPaymentStatus(
    status: SendCashbackResult['status'],
  ): CashbackPaymentStatus {
    if (status === CashbackProviderTransferStatus.Succeeded) {
      return CashbackPaymentStatus.Succeeded;
    }

    if (status === CashbackProviderTransferStatus.Pending) {
      return CashbackPaymentStatus.Processing;
    }

    return CashbackPaymentStatus.Failed;
  }

  private getStaleProcessingCutoff(): Date {
    const staleAfterSeconds = this.configService.get<number>(
      'CASHBACK_PROCESSING_STALE_AFTER_SECONDS',
      300,
    );

    return new Date(Date.now() - staleAfterSeconds * 1000);
  }
}
