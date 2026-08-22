import { AchievementEvaluatorService } from './achievement-evaluator.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';

describe('AchievementEvaluatorService', () => {
  const userId = 'd81cdd5c-2c45-4478-b0a5-b261b59c87b1';
  const achievements = [
    buildAchievement({
      id: '6c181d55-26cd-4fea-9f20-6fd4db974d10',
      name: 'First Purchase',
      threshold: 1,
      ordering: 10,
    }),
    buildAchievement({
      id: 'dc3ff15f-762d-4fb4-a09a-7841d2bff2f4',
      name: '5 Purchases',
      threshold: 5,
      ordering: 20,
    }),
  ];

  it('unlocks First Purchase on the first purchase', async () => {
    const { service } = createServiceHarness({ achievements });

    const result = await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 1,
    });

    expect(result.unlockedAchievements.map((achievement) => achievement.name)).toEqual([
      'First Purchase',
    ]);
  });

  it.each([2, 3, 4])(
    'does not unlock 5 Purchases at %i completed purchases',
    async (totalCompletedPurchases) => {
      const { service } = createServiceHarness({ achievements });

      const result = await service.evaluatePurchaseAchievements({
        userId,
        totalCompletedPurchases,
      });

      expect(
        result.unlockedAchievements.map((achievement) => achievement.name),
      ).not.toContain('5 Purchases');
    },
  );

  it('unlocks 5 Purchases when the fifth purchase is reached', async () => {
    const { service } = createServiceHarness({
      achievements,
      existingUnlocks: [`${userId}:${achievements[0].id}`],
    });

    const result = await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 5,
    });

    expect(result.unlockedAchievements.map((achievement) => achievement.name)).toEqual([
      '5 Purchases',
    ]);
  });

  it('ignores achievements the user already unlocked', async () => {
    const { service } = createServiceHarness({
      achievements,
      existingUnlocks: [`${userId}:${achievements[0].id}`],
    });

    const result = await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 1,
    });

    expect(result.unlockedAchievements).toEqual([]);
  });

  it('is safe when the same evaluation is processed more than once', async () => {
    const { service, unlockStore } = createServiceHarness({ achievements });

    await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 5,
    });
    const duplicateResult = await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 5,
    });

    expect(duplicateResult.unlockedAchievements).toEqual([]);
    expect(unlockStore.size).toBe(2);
  });

  it('evaluates thresholds from persisted progression definitions', async () => {
    const persistedAchievements = [
      ...achievements,
      buildAchievement({
        id: '9a84842d-a358-4afb-9eb5-ea532035bb77',
        name: '10 Purchases',
        threshold: 10,
        ordering: 30,
      }),
    ];
    const { service } = createServiceHarness({
      achievements: persistedAchievements,
    });

    const result = await service.evaluatePurchaseAchievements({
      userId,
      totalCompletedPurchases: 5,
    });

    expect(result.unlockedAchievements.map((achievement) => achievement.name)).toEqual([
      'First Purchase',
      '5 Purchases',
    ]);
  });
});

function createServiceHarness(options: {
  achievements: Achievement[];
  existingUnlocks?: string[];
}) {
  const unlockStore = new Set(options.existingUnlocks ?? []);
  const achievementRepository = new FakeAchievementRepository(
    options.achievements,
  );
  const userAchievementRepository = new FakeUserAchievementRepository(
    unlockStore,
  );
  const manager = new FakeEntityManager(
    achievementRepository,
    userAchievementRepository,
  );

  userAchievementRepository.manager = {
    transaction: jest.fn((callback) => callback(manager)),
  };

  return {
    service: new AchievementEvaluatorService(
      achievementRepository as never,
      userAchievementRepository as never,
    ),
    unlockStore,
  };
}

function buildAchievement(input: {
  id: string;
  name: string;
  threshold: number;
  ordering: number;
}): Achievement {
  return {
    id: input.id,
    name: input.name,
    group: 'purchases',
    threshold: input.threshold,
    ordering: input.ordering,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userAchievements: [],
  };
}

class FakeAchievementRepository {
  constructor(private readonly achievements: Achievement[]) {}

  async find(options: any): Promise<Achievement[]> {
    const group = options.where.group;
    const maxThreshold = options.where.threshold.value;

    return this.achievements
      .filter(
        (achievement) =>
          achievement.group === group && achievement.threshold <= maxThreshold,
      )
      .sort((left, right) => left.ordering - right.ordering);
  }
}

class FakeUserAchievementRepository {
  manager: any;

  constructor(private readonly unlockStore: Set<string>) {}

  createQueryBuilder() {
    return new FakeInsertQueryBuilder(this.unlockStore);
  }
}

class FakeEntityManager {
  constructor(
    private readonly achievementRepository: FakeAchievementRepository,
    private readonly userAchievementRepository: FakeUserAchievementRepository,
  ) {}

  getRepository(entity: unknown) {
    if (entity === Achievement) {
      return this.achievementRepository;
    }

    if (entity === UserAchievement) {
      return this.userAchievementRepository;
    }

    throw new Error('Unexpected repository requested');
  }
}

class FakeInsertQueryBuilder {
  private valuesPayload?: { userId: string; achievementId: string };

  constructor(private readonly unlockStore: Set<string>) {}

  insert() {
    return this;
  }

  values(payload: { userId: string; achievementId: string }) {
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

    const key = `${this.valuesPayload.userId}:${this.valuesPayload.achievementId}`;

    if (this.unlockStore.has(key)) {
      return { raw: [] };
    }

    this.unlockStore.add(key);

    return { raw: [{ id: key }] };
  }
}
