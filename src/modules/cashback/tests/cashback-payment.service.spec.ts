import { CashbackPaymentService } from '../cashback-payment.service';
import { CashbackPayment } from '../entities/cashback-payment.entity';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';

describe('CashbackPaymentService', () => {
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
    return new FakeInsertQueryBuilder(this.paymentStore);
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
}

class FakeInsertQueryBuilder {
  private valuesPayload?: Partial<CashbackPayment> & {
    userId: string;
    badgeId: string;
  };

  constructor(private readonly paymentStore: Map<string, CashbackPayment>) {}

  insert() {
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
}
