import { Badge } from '../../badges/entities/badge.entity';
import { BadgeUnlockedEvent } from '../../badges/events/badge-unlocked.event';
import { User } from '../../users/entities/user.entity';
import { CashbackPaymentService } from '../cashback-payment.service';
import { CashbackPayment } from '../entities/cashback-payment.entity';
import {
  CashbackProvider,
  CashbackProviderTransferStatus,
  SendCashbackRequest,
  SendCashbackResult,
} from '../providers/cashback-provider.types';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';
import { ProcessBadgeUnlockedCashbackListener } from './process-badge-unlocked-cashback.listener';

describe('ProcessBadgeUnlockedCashbackListener', () => {
  it('sends ₦300 cashback when a badge is unlocked', async () => {
    const { listener, provider, event } = createListenerHarness();

    await listener.handleBadgeUnlocked(event);

    expect(provider.requests).toEqual([
      {
        userId: event.user.id,
        amount: 300,
        reference: `cashback:${event.user.id}:${event.badge.id}`,
      },
    ]);
  });

  it('records successful provider results', async () => {
    const { listener, payments, event } = createListenerHarness({
      providerResults: [
        {
          provider: 'test-provider',
          providerReference: 'TRF_123',
          status: CashbackProviderTransferStatus.Succeeded,
          failureReason: null,
        },
      ],
    });

    await listener.handleBadgeUnlocked(event);

    const payment = payments.findPayment(event.user.id, event.badge.id);
    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Succeeded,
      providerReference: 'TRF_123',
      failureReason: null,
      attemptCount: 1,
    });
  });

  it('records failed provider results without removing badge state', async () => {
    const { listener, payments, event } = createListenerHarness({
      providerResults: [
        {
          provider: 'test-provider',
          providerReference: null,
          status: CashbackProviderTransferStatus.Failed,
          failureReason: 'Insufficient balance',
        },
      ],
    });

    await listener.handleBadgeUnlocked(event);

    const payment = payments.findPayment(event.user.id, event.badge.id);
    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Failed,
      failureReason: 'Insufficient balance',
      attemptCount: 1,
    });
    expect(event.badge.name).toBe('Beginner');
  });

  it('allows a failed payment to be retried successfully', async () => {
    const { listener, provider, payments, event } = createListenerHarness({
      providerResults: [
        {
          provider: 'test-provider',
          providerReference: null,
          status: CashbackProviderTransferStatus.Failed,
          failureReason: 'temporary provider failure',
        },
        {
          provider: 'test-provider',
          providerReference: 'TRF_retry',
          status: CashbackProviderTransferStatus.Succeeded,
          failureReason: null,
        },
      ],
    });

    await listener.handleBadgeUnlocked(event);
    await listener.handleBadgeUnlocked(event);

    const payment = payments.findPayment(event.user.id, event.badge.id);
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.reference).toBe(provider.requests[0]?.reference);
    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Succeeded,
      providerReference: 'TRF_retry',
      failureReason: null,
      attemptCount: 2,
    });
  });

  it('never resends already successful cashback', async () => {
    const { listener, provider, payments, event } = createListenerHarness();

    await listener.handleBadgeUnlocked(event);
    await listener.handleBadgeUnlocked(event);

    const payment = payments.findPayment(event.user.id, event.badge.id);
    expect(provider.requests).toHaveLength(1);
    expect(payment?.status).toBe(CashbackPaymentStatus.Succeeded);
    expect(payment?.attemptCount).toBe(1);
  });

  it('does not resend duplicate pending badge events', async () => {
    const user = buildUser();
    const badge = buildBadge();
    const payment = buildPayment({
      userId: user.id,
      badgeId: badge.id,
      status: CashbackPaymentStatus.Pending,
      attemptCount: 0,
    });
    const { listener, provider } = createListenerHarness({
      user,
      badge,
      initialPayments: [payment],
    });

    await listener.handleBadgeUnlocked(new BadgeUnlockedEvent(badge.name, user, badge));

    expect(provider.requests).toEqual([]);
  });

  it('sends the provider the correct user and idempotency reference', async () => {
    const { listener, provider, event } = createListenerHarness();

    await listener.handleBadgeUnlocked(event);

    expect(provider.requests[0]).toEqual({
      userId: event.user.id,
      amount: 300,
      reference: `cashback:${event.user.id}:${event.badge.id}`,
    });
  });
});

function createListenerHarness(options: {
  user?: User;
  badge?: Badge;
  initialPayments?: CashbackPayment[];
  providerResults?: SendCashbackResult[];
} = {}) {
  const user = options.user ?? buildUser();
  const badge = options.badge ?? buildBadge();
  const payments = new FakeCashbackPaymentService(options.initialPayments ?? []);
  const provider = new FakeCashbackProvider(options.providerResults);
  const listener = new ProcessBadgeUnlockedCashbackListener(
    payments as unknown as CashbackPaymentService,
    provider,
  );

  return {
    event: new BadgeUnlockedEvent(badge.name, user, badge),
    listener,
    payments,
    provider,
  };
}

function buildUser(): User {
  return {
    id: 'f574c708-f2f5-4a48-8cc9-a3f5d5c4c8c9',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Customer',
    accountNumber: '0123456789',
    bankCode: '044',
    accountName: 'ADA CUSTOMER',
    currency: 'NGN',
    payoutRecipientReference: 'RCP_customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    achievements: [],
    badges: [],
    purchases: [],
  };
}

function buildBadge(): Badge {
  return {
    id: '0eccbf64-bd65-43e1-8390-bc720bef5c59',
    name: 'Beginner',
    requiredAchievementCount: 1,
    ordering: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userBadges: [],
  };
}

function buildPayment(input: {
  userId: string;
  badgeId: string;
  status: CashbackPaymentStatus;
  attemptCount: number;
}): CashbackPayment {
  return {
    id: 'c2d4a2b3-9657-46e6-b50f-8f64ae4e6b44',
    userId: input.userId,
    badgeId: input.badgeId,
    amount: 300,
    reference: `cashback:${input.userId}:${input.badgeId}`,
    provider: 'test-provider',
    providerReference: null,
    status: input.status,
    failureReason: null,
    attemptCount: input.attemptCount,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as CashbackPayment;
}

class FakeCashbackPaymentService {
  private readonly paymentStore = new Map<string, CashbackPayment>();

  constructor(initialPayments: CashbackPayment[]) {
    for (const payment of initialPayments) {
      this.paymentStore.set(this.key(payment.userId, payment.badgeId), payment);
    }
  }

  async createPendingCashbackPayment(input: {
    userId: string;
    badgeId: string;
    amount: number;
    provider: string;
  }) {
    const key = this.key(input.userId, input.badgeId);
    const existingPayment = this.paymentStore.get(key);

    if (existingPayment) {
      return {
        payment: existingPayment,
        created: false,
      };
    }

    const payment = buildPayment({
      userId: input.userId,
      badgeId: input.badgeId,
      status: CashbackPaymentStatus.Pending,
      attemptCount: 0,
    });
    payment.provider = input.provider;
    payment.amount = input.amount;
    this.paymentStore.set(key, payment);

    return {
      payment,
      created: true,
    };
  }

  async markCashbackAttemptStarted(paymentId: string): Promise<void> {
    const payment = this.findPaymentById(paymentId);
    payment.status = CashbackPaymentStatus.Processing;
    payment.failureReason = null;
    payment.attemptCount += 1;
  }

  async recordProviderResult(input: {
    paymentId: string;
    provider: string;
    providerReference?: string | null;
    status: CashbackPaymentStatus;
    failureReason?: string | null;
  }): Promise<void> {
    const payment = this.findPaymentById(input.paymentId);
    payment.provider = input.provider;
    payment.providerReference = input.providerReference ?? null;
    payment.status = input.status;
    payment.failureReason = input.failureReason ?? null;
  }

  findPayment(userId: string, badgeId: string): CashbackPayment | undefined {
    return this.paymentStore.get(this.key(userId, badgeId));
  }

  private findPaymentById(paymentId: string): CashbackPayment {
    for (const payment of this.paymentStore.values()) {
      if (payment.id === paymentId) {
        return payment;
      }
    }

    throw new Error('Payment was not found');
  }

  private key(userId: string, badgeId: string): string {
    return `${userId}:${badgeId}`;
  }
}

class FakeCashbackProvider implements CashbackProvider {
  readonly providerName = 'test-provider';
  readonly requests: SendCashbackRequest[] = [];
  private readonly results: SendCashbackResult[];

  constructor(results: SendCashbackResult[] = []) {
    this.results = [...results];
  }

  async sendCashback(request: SendCashbackRequest): Promise<SendCashbackResult> {
    this.requests.push(request);

    return (
      this.results.shift() ?? {
        provider: this.providerName,
        providerReference: 'TRF_default',
        status: CashbackProviderTransferStatus.Succeeded,
        failureReason: null,
      }
    );
  }
}
