import { CashbackPaymentService } from '../cashback-payment.service';
import { CashbackPayment } from '../entities/cashback-payment.entity';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';

describe('CashbackPaymentService', () => {
  const staleProcessingCutoff = new Date('2026-08-24T12:00:00.000Z');
  const input = {
    userId: '25c278b1-2809-4c59-b93c-5c9b771f08bc',
    badgeId: '44d7205f-2f02-401b-8af5-d65ee9b1deea',
    amount: 300,
    provider: 'local-test-provider',
  };

  it('creates a pending cashback payment with the initial auditable state', async () => {
    const { service } = createServiceHarness();

    const result = await service.createPendingCashbackPayment(input);

    expect(result.created).toBe(true);
    expect(result.payment).toMatchObject({
      userId: input.userId,
      badgeId: input.badgeId,
      amount: 300,
      provider: 'local-test-provider',
      providerReference: null,
      status: CashbackPaymentStatus.Pending,
      failureReason: null,
      attemptCount: 0,
    });
  });

  it('uses a deterministic idempotency reference for the user and badge', async () => {
    const { service } = createServiceHarness();

    const result = await service.createPendingCashbackPayment(input);

    expect(result.payment.reference).toBe(
      `cashback:${input.userId}:${input.badgeId}`,
    );
  });

  it('makes duplicate cashback creation harmless', async () => {
    const { service, paymentStore } = createServiceHarness();

    const firstResult = await service.createPendingCashbackPayment(input);
    const duplicateResult = await service.createPendingCashbackPayment(input);

    expect(firstResult.created).toBe(true);
    expect(duplicateResult.created).toBe(false);
    expect(paymentStore.size).toBe(1);
    expect(duplicateResult.payment.id).toBe(firstResult.payment.id);
  });

  it('marks attempts as processing and increments the attempt count', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);

    await expect(
      service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff),
    ).resolves.toBe(true);

    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Processing,
      failureReason: null,
      attemptCount: 1,
    });
  });

  it('does not claim an already-processing payment attempt', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);

    await service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff);
    await expect(
      service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff),
    ).resolves.toBe(false);

    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Processing,
      attemptCount: 1,
    });
  });

  it('can claim failed payments for retry', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);
    payment.status = CashbackPaymentStatus.Failed;

    await expect(
      service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff),
    ).resolves.toBe(true);

    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Processing,
      attemptCount: 1,
    });
  });

  it('does not claim fresh processing payments', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);
    payment.status = CashbackPaymentStatus.Processing;
    payment.updatedAt = new Date('2026-08-24T12:01:00.000Z');

    await expect(
      service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff),
    ).resolves.toBe(false);

    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Processing,
      attemptCount: 0,
    });
  });

  it('claims stale processing payments for crash recovery', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);
    payment.status = CashbackPaymentStatus.Processing;
    payment.updatedAt = new Date('2026-08-24T11:59:00.000Z');

    await expect(
      service.markCashbackAttemptStarted(payment.id, staleProcessingCutoff),
    ).resolves.toBe(true);

    expect(payment).toMatchObject({
      status: CashbackPaymentStatus.Processing,
      attemptCount: 1,
    });
  });

  it('records provider outcomes on the payment record', async () => {
    const { service } = createServiceHarness();
    const { payment } = await service.createPendingCashbackPayment(input);

    await service.recordProviderResult({
      paymentId: payment.id,
      provider: 'test-provider',
      providerReference: 'TRF_123',
      status: CashbackPaymentStatus.Succeeded,
      failureReason: null,
    });

    expect(payment).toMatchObject({
      provider: 'test-provider',
      providerReference: 'TRF_123',
      status: CashbackPaymentStatus.Succeeded,
      failureReason: null,
    });
  });
});

function createServiceHarness() {
  const paymentStore = new Map<string, CashbackPayment>();
  const repository = new FakeCashbackPaymentRepository(paymentStore);

  return {
    paymentStore,
    service: new CashbackPaymentService(repository as never),
  };
}

class FakeCashbackPaymentRepository {
  constructor(private readonly paymentStore: Map<string, CashbackPayment>) {}

  createQueryBuilder() {
    return new FakeQueryBuilder(this.paymentStore);
  }

  async findOneOrFail(options: {
    where: { userId: string; badgeId: string };
  }): Promise<CashbackPayment> {
    const key = `${options.where.userId}:${options.where.badgeId}`;
    const payment = this.paymentStore.get(key);

    if (!payment) {
      throw new Error('Cashback payment was not found');
    }

    return payment;
  }

  async update(
    criteria: { id: string },
    payload: Partial<CashbackPayment>,
  ): Promise<void> {
    const payment = this.findPaymentById(criteria.id);
    Object.assign(payment, payload);
  }

  private findPaymentById(paymentId: string): CashbackPayment {
    for (const payment of this.paymentStore.values()) {
      if (payment.id === paymentId) {
        return payment;
      }
    }

    throw new Error('Cashback payment was not found');
  }
}

class FakeQueryBuilder {
  private valuesPayload?: Partial<CashbackPayment> & {
    userId: string;
    badgeId: string;
  };
  private paymentId?: string;
  private claimableStatuses?: CashbackPaymentStatus[];
  private processingStatus?: CashbackPaymentStatus;
  private staleProcessingCutoff?: Date;

  constructor(private readonly paymentStore: Map<string, CashbackPayment>) {}

  insert() {
    return this;
  }

  update() {
    return this;
  }

  set(payload: {
    status: CashbackPaymentStatus;
    failureReason: null;
    attemptCount: () => string;
  }) {
    payload.attemptCount();

    return this;
  }

  where(_condition: string, parameters: { paymentId: string }) {
    this.paymentId = parameters.paymentId;
    return this;
  }

  andWhere(
    _condition: string,
    parameters: {
      claimableStatuses: CashbackPaymentStatus[];
      processingStatus: CashbackPaymentStatus;
      staleProcessingCutoff: Date;
    },
  ) {
    this.claimableStatuses = parameters.claimableStatuses;
    this.processingStatus = parameters.processingStatus;
    this.staleProcessingCutoff = parameters.staleProcessingCutoff;
    return this;
  }

  values(
    payload: Partial<CashbackPayment> & { userId: string; badgeId: string },
  ) {
    this.valuesPayload = payload;
    return this;
  }

  orIgnore() {
    return this;
  }

  returning() {
    return this;
  }

  async execute() {
    if (this.paymentId) {
      const payment = this.findPaymentById(this.paymentId);

      if (
        this.claimableStatuses &&
        !this.isClaimable(payment)
      ) {
        return { raw: [] };
      }

      payment.status = CashbackPaymentStatus.Processing;
      payment.failureReason = null;
      payment.attemptCount += 1;

      return { raw: [{ id: payment.id }] };
    }

    if (!this.valuesPayload) {
      throw new Error('Insert values were not provided');
    }

    const key = `${this.valuesPayload.userId}:${this.valuesPayload.badgeId}`;

    if (this.paymentStore.has(key)) {
      return { raw: [] };
    }

    const payment = {
      id: '635ac985-0e3c-4b88-9945-41f61035cce5',
      userId: this.valuesPayload.userId,
      badgeId: this.valuesPayload.badgeId,
      amount: this.valuesPayload.amount,
      reference: this.valuesPayload.reference,
      provider: this.valuesPayload.provider,
      providerReference: null,
      status: this.valuesPayload.status,
      failureReason: null,
      attemptCount: this.valuesPayload.attemptCount,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as CashbackPayment;

    this.paymentStore.set(key, payment);

    return { raw: [{ id: payment.id }] };
  }

  private findPaymentById(paymentId: string): CashbackPayment {
    for (const payment of this.paymentStore.values()) {
      if (payment.id === paymentId) {
        return payment;
      }
    }

    throw new Error('Cashback payment was not found');
  }

  private isClaimable(payment: CashbackPayment): boolean {
    if (this.claimableStatuses?.includes(payment.status)) {
      return true;
    }

    return (
      payment.status === this.processingStatus &&
      !!this.staleProcessingCutoff &&
      payment.updatedAt < this.staleProcessingCutoff
    );
  }
}
