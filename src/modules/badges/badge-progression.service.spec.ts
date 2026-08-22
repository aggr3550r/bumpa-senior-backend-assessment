import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import { BadgeProgressionService } from './badge-progression.service';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';

describe('BadgeProgressionService', () => {
  const userId = 'f2c3aa95-35f9-4a78-b245-d750b6a80ea2';
  const badges = [
    buildBadge({
      id: '64582fcf-62fd-4db2-bbbb-a29732404697',
      name: 'Beginner',
      requiredAchievementCount: 1,
      ordering: 10,
    }),
    buildBadge({
      id: '534d9af0-f535-443d-a5a4-af316bde7c61',
      name: 'Advanced',
      requiredAchievementCount: 8,
      ordering: 20,
    }),
  ];

  it('does not earn a badge before its threshold', async () => {
    const { service } = createServiceHarness({
      badges,
      achievementCount: 0,
    });

    const result = await service.evaluateBadgeProgression({ userId });

    expect(result.newlyUnlockedBadge).toBeNull();
    expect(result.nextBadge?.name).toBe('Beginner');
  });

  it('earns a badge at its threshold', async () => {
    const { service } = createServiceHarness({
      badges,
      achievementCount: 1,
    });

    const result = await service.evaluateBadgeProgression({ userId });

    expect(result.newlyUnlockedBadge?.name).toBe('Beginner');
  });

  it('ignores a badge the user already earned', async () => {
    const { service } = createServiceHarness({
      badges,
      achievementCount: 1,
      existingBadgeUnlocks: [`${userId}:${badges[0].id}`],
    });

    const result = await service.evaluateBadgeProgression({ userId });

    expect(result.newlyUnlockedBadge).toBeNull();
    expect(result.nextBadge?.name).toBe('Advanced');
  });

  it('is safe when the same achievement event is processed more than once', async () => {
    const { service, badgeUnlockStore } = createServiceHarness({
      badges,
      achievementCount: 1,
    });

    await service.evaluateBadgeProgression({ userId });
    const duplicateResult = await service.evaluateBadgeProgression({ userId });

    expect(duplicateResult.newlyUnlockedBadge).toBeNull();
    expect(badgeUnlockStore.size).toBe(1);
  });

  it('identifies the correct next badge', async () => {
    const { service } = createServiceHarness({
      badges,
      achievementCount: 5,
      existingBadgeUnlocks: [`${userId}:${badges[0].id}`],
    });

    const result = await service.evaluateBadgeProgression({ userId });

    expect(result.newlyUnlockedBadge).toBeNull();
    expect(result.nextBadge?.name).toBe('Advanced');
  });

  it('unlocks the highest newly eligible missing badge by persisted ordering', async () => {
    const { service } = createServiceHarness({
      badges,
      achievementCount: 8,
    });

    const result = await service.evaluateBadgeProgression({ userId });

    expect(result.newlyUnlockedBadge?.name).toBe('Advanced');
    expect(result.nextBadge).toBeNull();
  });
});

function createServiceHarness(options: {
  badges: Badge[];
  achievementCount: number;
  existingBadgeUnlocks?: string[];
}) {
  const badgeUnlockStore = new Set(options.existingBadgeUnlocks ?? []);
  const badgeRepository = new FakeBadgeRepository(options.badges);
  const userBadgeRepository = new FakeUserBadgeRepository(badgeUnlockStore);
  const userAchievementRepository = new FakeUserAchievementRepository(
    options.achievementCount,
  );
  const manager = new FakeEntityManager(
    badgeRepository,
    userBadgeRepository,
    userAchievementRepository,
  );

  userBadgeRepository.manager = {
    transaction: jest.fn((callback) => callback(manager)),
  };

  return {
    badgeUnlockStore,
    service: new BadgeProgressionService(
      badgeRepository as never,
      userBadgeRepository as never,
    ),
  };
}

function buildBadge(input: {
  id: string;
  name: string;
  requiredAchievementCount: number;
  ordering: number;
}): Badge {
  return {
    id: input.id,
    name: input.name,
    requiredAchievementCount: input.requiredAchievementCount,
    ordering: input.ordering,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userBadges: [],
  };
}

class FakeBadgeRepository {
  constructor(private readonly badges: Badge[]) {}

  async find(): Promise<Badge[]> {
    return [...this.badges].sort((left, right) => left.ordering - right.ordering);
  }
}

class FakeUserBadgeRepository {
  manager: any;

  constructor(private readonly badgeUnlockStore: Set<string>) {}

  async find(options: any): Promise<Pick<UserBadge, 'badgeId'>[]> {
    const userId = options.where.userId;

    return [...this.badgeUnlockStore]
      .filter((key) => key.startsWith(`${userId}:`))
      .map((key) => ({ badgeId: key.split(':')[1] }));
  }

  createQueryBuilder() {
    return new FakeInsertQueryBuilder(this.badgeUnlockStore);
  }
}

class FakeUserAchievementRepository {
  constructor(private readonly achievementCount: number) {}

  async count(): Promise<number> {
    return this.achievementCount;
  }
}

class FakeEntityManager {
  constructor(
    private readonly badgeRepository: FakeBadgeRepository,
    private readonly userBadgeRepository: FakeUserBadgeRepository,
    private readonly userAchievementRepository: FakeUserAchievementRepository,
  ) {}

  getRepository(entity: unknown) {
    if (entity === Badge) {
      return this.badgeRepository;
    }

    if (entity === UserBadge) {
      return this.userBadgeRepository;
    }

    if (entity === UserAchievement) {
      return this.userAchievementRepository;
    }

    throw new Error('Unexpected repository requested');
  }
}

class FakeInsertQueryBuilder {
  private valuesPayload?: { userId: string; badgeId: string };

  constructor(private readonly badgeUnlockStore: Set<string>) {}

  insert() {
    return this;
  }

  values(payload: { userId: string; badgeId: string }) {
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

    if (this.badgeUnlockStore.has(key)) {
      return { raw: [] };
    }

    this.badgeUnlockStore.add(key);

    return { raw: [{ id: key }] };
  }
}
