import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BadgeUnlockedEvent } from '../../badges/events/badge-unlocked.event';
import { BADGE_UNLOCKED_EVENT } from '../../badges/events/badge.events';
import { CASHBACK_PROVIDER } from '../providers/cashback-provider.constants';
import { CashbackProvider } from '../providers/cashback-provider.types';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';
import { CashbackPaymentService } from '../cashback-payment.service';

const BADGE_CASHBACK_AMOUNT = 300;

@Injectable()
export class ProcessBadgeUnlockedCashbackListener {
  constructor(
    private readonly cashbackPayments: CashbackPaymentService,
    @Inject(CASHBACK_PROVIDER)
    private readonly cashbackProvider: CashbackProvider,
  ) {}

  @OnEvent(BADGE_UNLOCKED_EVENT)
  async handleBadgeUnlocked(event: BadgeUnlockedEvent): Promise<void> {
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

    if (payment.status === CashbackPaymentStatus.Succeeded) {
      return;
    }

    /*
     * A fresh entitlement should be sent once. A failed entitlement may be
     * retried safely because the same persisted reference is reused as the
     * provider idempotency key. Pending/processing rows are left alone here so a
     * duplicate BadgeUnlocked event cannot double-send while work is in flight.
     */
    if (!created && payment.status !== CashbackPaymentStatus.Failed) {
      return;
    }

    await this.cashbackProvider.sendCashback({
      userId: event.user.id,
      amount: BADGE_CASHBACK_AMOUNT,
      reference: payment.reference,
    });
  }
}
