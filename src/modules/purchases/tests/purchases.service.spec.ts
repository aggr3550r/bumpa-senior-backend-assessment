import { NotFoundException } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { PURCHASE_COMPLETED_OUTBOX_EVENT } from '../../../outbox/outbox-event.types';
import { OutboxService } from '../../../outbox/outbox.service';
import { Purchase } from '../entities/purchase.entity';
import { PurchasesService } from '../purchases.service';
import { PurchaseStatus } from '../types/purchase-status.enum';

describe('PurchasesService', () => {
  const user = buildUser();

  it('persists a completed purchase and records purchase progress in the outbox', async () => {
    const { service, outbox } = createServiceHarness({
      user,
      completedPurchaseCount: 5,
    });

    const result = await service.createCompletedPurchase(user.id, 1200);

    expect(result.purchase).toMatchObject({
      userId: user.id,
      amount: 1200,
      status: PurchaseStatus.Completed,
    });
    expect(result.totalCompletedPurchases).toBe(5);
    expect(outbox.create).toHaveBeenCalledWith(expect.any(FakeEntityManager), {
      eventType: PURCHASE_COMPLETED_OUTBOX_EVENT,
      aggregateType: 'purchase',
      aggregateId: result.purchase.id,
      payload: {
        purchaseId: result.purchase.id,
        userId: user.id,
        totalCompletedPurchases: 5,
      },
    });
  });

  it('rejects purchases for missing users before recording outbox events', async () => {
    const { service, outbox } = createServiceHarness({
      user: null,
      completedPurchaseCount: 0,
    });

    await expect(
      service.createCompletedPurchase(user.id, 1200),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(outbox.create).not.toHaveBeenCalled();
  });
});

function createServiceHarness(options: {
  user: User | null;
  completedPurchaseCount: number;
}) {
  const userRepository = new FakeUserRepository(options.user);
  const purchaseRepository = new FakePurchaseRepository(
    options.completedPurchaseCount,
  );
  const manager = new FakeEntityManager(userRepository, purchaseRepository);
  const rootPurchaseRepository = {
    manager: {
      transaction: jest.fn((callback) => callback(manager)),
    },
  };
  const outbox = {
    create: jest.fn(async () => undefined),
  };

  return {
    outbox,
    service: new PurchasesService(
      rootPurchaseRepository as never,
      outbox as unknown as OutboxService,
    ),
  };
}

function buildUser(): User {
  return {
    id: '1b246783-79b7-438d-b3cf-3fe1c23db8fb',
    email: 'customer@example.com',
    firstName: 'Ada',
    lastName: 'Customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    achievements: [],
    badges: [],
    purchases: [],
  };
}

class FakeUserRepository {
  constructor(private readonly user: User | null) {}

  async findOne(): Promise<User | null> {
    return this.user;
  }
}

class FakePurchaseRepository {
  constructor(private readonly completedPurchaseCount: number) {}

  create(payload: Partial<Purchase>): Purchase {
    return {
      id: 'f2cf7707-e6bb-4688-b57c-1ad3c48615fd',
      userId: payload.userId,
      amount: payload.amount,
      status: payload.status,
      completedAt: payload.completedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as Purchase;
  }

  async save(purchase: Purchase): Promise<Purchase> {
    return purchase;
  }

  async count(): Promise<number> {
    return this.completedPurchaseCount;
  }
}

class FakeEntityManager {
  constructor(
    private readonly userRepository: FakeUserRepository,
    private readonly purchaseRepository: FakePurchaseRepository,
  ) {}

  getRepository(entity: unknown) {
    if (entity === User) {
      return this.userRepository;
    }

    if (entity === Purchase) {
      return this.purchaseRepository;
    }

    throw new Error('Unexpected repository requested');
  }
}
