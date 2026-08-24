import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { BadgeUnlockedEvent } from '../../badges/events/badge-unlocked.event';
import { BADGE_UNLOCKED_EVENT } from '../../badges/events/badge.events';
import { CASHBACK_PROVIDER } from '../providers/cashback-provider.constants';
import {
  CashbackProvider,
  CashbackProviderTransferStatus,
  SendCashbackResult,
} from '../providers/cashback-provider.types';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';
import { CashbackPaymentService } from '../cashback-payment.service';

const BADGE_CASHBACK_AMOUNT = 300;

@Injectable()
export class ProcessBadgeUnlockedCashbackListener {
  private readonly logger = new Logger(ProcessBadgeUnlockedCashbackListener.name);

  constructor(
    private readonly cashbackPayments: CashbackPaymentService,
    private readonly configService: ConfigService,
    @Inject(CASHBACK_PROVIDER)
    private readonly cashbackProvider: CashbackProvider,
  ) {}

  @OnEvent(BADGE_UNLOCKED_EVENT)
  async handleBadgeUnlocked(event: BadgeUnlockedEvent): Promise<void> {
    this.logger.log(
      `Processing cashback for badge unlock: userId=${event.user.id}, badgeId=${event.badge.id}, badgeName=${event.badgeName}`,
    );

    /*
     * BadgeUnlocked is delivered with at-least-once semantics: listeners may see
     * the same event again after retries or duplicate emission. The persisted
     * user/badge entitlement is the idempotency boundary, so duplicate events do
     * not create duplicate cashback rows or resend already successful cashback.
     */
    const { payment, created } =
      await this.cashbackPayments.createPendingCashbackPayment({
        userId: event.user.id,
        badgeId: event.badge.id,
        amount: BADGE_CASHBACK_AMOUNT,
        provider: this.cashbackProvider.providerName,
      });

    this.logger.log(
      `Cashback entitlement resolved: paymentId=${payment.id}, created=${created}, status=${payment.status}, provider=${this.cashbackProvider.providerName}, reference=${payment.reference}`,
    );

    if (payment.status === CashbackPaymentStatus.Succeeded) {
      this.logger.log(
        `Skipping cashback because payment already succeeded: paymentId=${payment.id}`,
      );

      return;
    }

    /*
     * A fresh entitlement should be sent once. A failed entitlement may be
     * retried safely because the same persisted reference is reused as the
     * provider idempotency key. Pending rows are left alone here; processing
     * rows continue to the atomic claim so stale attempts can recover after a
     * crash while fresh attempts still reject duplicate work.
     */
    if (
      !created &&
      ![
        CashbackPaymentStatus.Failed,
        CashbackPaymentStatus.Processing,
      ].includes(payment.status)
    ) {
      this.logger.log(
        `Skipping duplicate cashback event while payment is ${payment.status}: paymentId=${payment.id}`,
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

    this.logger.log(
      `Cashback provider attempt started: paymentId=${payment.id}, amount=${BADGE_CASHBACK_AMOUNT}, reference=${payment.reference}`,
    );

    try {
      const result = await this.cashbackProvider.sendCashback({
        userId: event.user.id,
        amount: BADGE_CASHBACK_AMOUNT,
        reference: payment.reference,
      });
      const paymentStatus = this.toPaymentStatus(result.status);

      this.logger.log(
        `Cashback provider result: paymentId=${payment.id}, provider=${result.provider}, providerStatus=${result.status}, paymentStatus=${paymentStatus}, providerReference=${result.providerReference ?? 'null'}, failureReason=${result.failureReason ?? 'null'}`,
      );

      await this.cashbackPayments.recordProviderResult({
        paymentId: payment.id,
        provider: result.provider,
        providerReference: result.providerReference,
        status: paymentStatus,
        failureReason: result.failureReason,
      });
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
