import { Job } from 'bullmq';
import { AchievementEvaluatorService } from '../../modules/achievements/achievement-evaluator.service';
import { BadgeProgressionService } from '../../modules/badges/badge-progression.service';
import {
  ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
  BADGE_UNLOCKED_OUTBOX_EVENT,
  PURCHASE_COMPLETED_OUTBOX_EVENT,
} from '../../outbox/outbox-event.types';
import { AchievementUnlockedProcessor } from './achievement-unlocked.processor';
import { PurchaseCompletedProcessor } from './purchase-completed.processor';
import { BadgeUnlockedCashbackProcessor } from './badge-unlocked-cashback.processor';
import { CashbackPaymentService } from '../../modules/cashback/cashback-payment.service';
import {
  CashbackProvider,
  CashbackProviderTransferStatus,
} from '../../modules/cashback/providers/cashback-provider.types';
import { CashbackPaymentStatus } from '../../modules/cashback/types/cashback-payment-status.enum';
import { ConfigService } from '@nestjs/config';

describe('domain queue processors', () => {
  it('evaluates achievements from purchase completed jobs', async () => {
    const achievementEvaluator = {
      evaluatePurchaseAchievements: jest.fn(async () => undefined),
    };
    const processor = new PurchaseCompletedProcessor(
      achievementEvaluator as unknown as AchievementEvaluatorService,
    );

    await processor.process({
      name: PURCHASE_COMPLETED_OUTBOX_EVENT,
      data: {
        purchaseId: 'purchase-id',
        userId: 'user-id',
        totalCompletedPurchases: 5,
      },
    } as Job);

    expect(achievementEvaluator.evaluatePurchaseAchievements).toHaveBeenCalledWith(
      {
        userId: 'user-id',
        totalCompletedPurchases: 5,
      },
    );
  });

  it('evaluates badges from achievement unlocked jobs', async () => {
    const badgeProgression = {
      evaluateBadgeProgression: jest.fn(async () => undefined),
    };
    const processor = new AchievementUnlockedProcessor(
      badgeProgression as unknown as BadgeProgressionService,
    );

    await processor.process({
      name: ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
      data: {
        achievementId: 'achievement-id',
        achievementName: '5 Purchases',
        userId: 'user-id',
      },
    } as Job);

    expect(badgeProgression.evaluateBadgeProgression).toHaveBeenCalledWith({
      userId: 'user-id',
    });
  });

  it('processes cashback from badge unlocked jobs', async () => {
    const payment = {
      id: 'payment-id',
      userId: 'user-id',
      badgeId: 'badge-id',
      reference: 'cashback:user-id:badge-id',
      status: CashbackPaymentStatus.Pending,
    };
    const cashbackPayments = {
      createPendingCashbackPayment: jest.fn(async () => ({
        payment,
        created: true,
      })),
      markCashbackAttemptStarted: jest.fn(async () => true),
      recordProviderResult: jest.fn(async () => undefined),
    };
    const provider = {
      providerName: 'test-provider',
      sendCashback: jest.fn(async () => ({
        provider: 'test-provider',
        providerReference: 'TRF_123',
        status: CashbackProviderTransferStatus.Succeeded,
        failureReason: null,
      })),
    };
    const configService = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    };
    const processor = new BadgeUnlockedCashbackProcessor(
      cashbackPayments as unknown as CashbackPaymentService,
      configService as unknown as ConfigService,
      provider as unknown as CashbackProvider,
    );

    await processor.process({
      name: BADGE_UNLOCKED_OUTBOX_EVENT,
      data: {
        badgeId: 'badge-id',
        badgeName: 'Starter',
        userId: 'user-id',
      },
    } as Job);

    expect(cashbackPayments.createPendingCashbackPayment).toHaveBeenCalledWith({
      userId: 'user-id',
      badgeId: 'badge-id',
      amount: 300,
      provider: 'test-provider',
    });
    expect(provider.sendCashback).toHaveBeenCalledWith({
      userId: 'user-id',
      amount: 300,
      reference: 'cashback:user-id:badge-id',
    });
    expect(cashbackPayments.recordProviderResult).toHaveBeenCalledWith({
      paymentId: 'payment-id',
      provider: 'test-provider',
      providerReference: 'TRF_123',
      status: CashbackPaymentStatus.Succeeded,
      failureReason: null,
    });
  });
});
