import { NotFoundException } from '@nestjs/common';
import { UserAchievementProgressQueryService } from '../user-achievement-progress-query.service';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { Badge } from '../../badges/entities/badge.entity';
import { UserBadge } from '../../badges/entities/user-badge.entity';

describe('UserAchievementProgressQueryService', () => {
  const userId = 'f4d3bf0c-aad1-402b-a13d-6619d4b286f0';
  const achievements = [
    buildAchievement({
      id: '3d916f74-b1ac-48e7-8ba6-2e3f946b8ed4',
      name: 'First Purchase',
      group: 'purchases',
      threshold: 1,
      ordering: 10,
    }),
    buildAchievement({
      id: '1964d0e4-bd26-4035-97ef-f317a7bb8a9e',
      name: '5 Purchases',
      group: 'purchases',
      threshold: 5,
      ordering: 20,
    }),
    buildAchievement({
      id: 'ec30128e-37ef-428a-b980-9fd9d958d631',
      name: 'First Review',
      group: 'reviews',
      threshold: 1,
      ordering: 10,
    }),
  ];
  const badges = [
    buildBadge({
      id: '871ea4d7-134e-4b5a-8f33-aa3cd09917dc',
      name: 'Starter',
      requiredAchievementCount: 2,
      ordering: 10,
    }),
    buildBadge({
      id: '55f15c83-814b-427e-8648-eb6f0579ae47',
      name: 'Loyal Customer',
      requiredAchievementCount: 5,
      ordering: 20,
    }),
  ];

  it('returns a new user progression summary', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
    });

    await expect(service.getUserAchievementProgress(userId)).resolves.toEqual({
      unlockedAchievements: [],
      nextAvailableAchievements: ['First Purchase', 'First Review'],
      currentBadge: null,
      nextBadge: 'Starter',
      remainingToUnlockNextBadge: 2,
    });
  });

  it('returns unlocked achievements in deterministic progression order', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
      userAchievementIds: [achievements[1].id, achievements[0].id],
    });

    const result = await service.getUserAchievementProgress(userId);

    expect(result.unlockedAchievements).toEqual([
      'First Purchase',
      '5 Purchases',
    ]);
  });

  it('returns exactly one next available achievement per group', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
      userAchievementIds: [achievements[0].id],
    });

    const result = await service.getUserAchievementProgress(userId);

    expect(result.nextAvailableAchievements).toEqual([
      '5 Purchases',
      'First Review',
    ]);
  });

  it('avoids N+1 lookups while assembling progress', async () => {
    const {
      achievementRepository,
      badgeRepository,
      service,
      userAchievementRepository,
      userBadgeRepository,
    } = createServiceHarness({
      achievements,
      badges,
      userAchievementIds: [achievements[0].id],
      userBadgeIds: [badges[0].id],
    });

    await service.getUserAchievementProgress(userId);

    expect(achievementRepository.findCalls).toBe(1);
    expect(userAchievementRepository.findCalls).toBe(1);
    expect(badgeRepository.findCalls).toBe(1);
    expect(userBadgeRepository.findCalls).toBe(1);
  });


  it('returns current badge, next badge, and remaining count', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
      userAchievementIds: [achievements[0].id, achievements[1].id],
      userBadgeIds: [badges[0].id],
    });

    await expect(service.getUserAchievementProgress(userId)).resolves.toEqual({
      unlockedAchievements: ['First Purchase', '5 Purchases'],
      nextAvailableAchievements: ['First Review'],
      currentBadge: 'Starter',
      nextBadge: 'Loyal Customer',
      remainingToUnlockNextBadge: 3,
    });
  });

  it('clamps remaining count at terminal badge state', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
      userAchievementIds: achievements.map((achievement) => achievement.id),
      userBadgeIds: badges.map((badge) => badge.id),
    });

    const result = await service.getUserAchievementProgress(userId);

    expect(result.currentBadge).toBe('Loyal Customer');
    expect(result.nextBadge).toBeNull();
    expect(result.remainingToUnlockNextBadge).toBe(0);
  });

  it('throws when the user does not exist', async () => {
    const { service } = createServiceHarness({
      achievements,
      badges,
      userExists: false,
    });

    await expect(service.getUserAchievementProgress(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function createServiceHarness(options: {
  achievements: Achievement[];
  badges: Badge[];
  userExists?: boolean;
  userAchievementIds?: string[];
  userBadgeIds?: string[];
}) {
  const userRepository = {
    exist: jest.fn(async () => options.userExists ?? true),
  };
  const achievementRepository = new FakeAchievementRepository(
    options.achievements,
  );
  const userAchievementRepository = new FakeUserAchievementRepository(
    userIdFromHarness,
    options.userAchievementIds ?? [],
  );
  const badgeRepository = new FakeBadgeRepository(options.badges);
  const userBadgeRepository = new FakeUserBadgeRepository(
    userIdFromHarness,
    options.userBadgeIds ?? [],
  );

  return {
    achievementRepository,
    badgeRepository,
    service: new UserAchievementProgressQueryService(
      userRepository as never,
      achievementRepository as never,
      userAchievementRepository as never,
      badgeRepository as never,
      userBadgeRepository as never,
    ),
    userAchievementRepository,
    userBadgeRepository,
  };
}

const userIdFromHarness = 'f4d3bf0c-aad1-402b-a13d-6619d4b286f0';

function buildAchievement(input: {
  id: string;
  name: string;
  group: string;
  threshold: number;
  ordering: number;
}): Achievement {
  return {
    id: input.id,
    name: input.name,
    group: input.group,
    threshold: input.threshold,
    ordering: input.ordering,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userAchievements: [],
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

class FakeAchievementRepository {
  findCalls = 0;

  constructor(private readonly achievements: Achievement[]) {}

  async find(): Promise<Achievement[]> {
    this.findCalls += 1;

    return [...this.achievements].sort((left, right) => {
      const groupOrder = left.group.localeCompare(right.group);

      return groupOrder || left.ordering - right.ordering;
    });
  }
}

class FakeUserAchievementRepository {
  findCalls = 0;

  constructor(
    private readonly userId: string,
    private readonly achievementIds: string[],
  ) {}

  async find(options: {
    where: { userId: string };
  }): Promise<Pick<UserAchievement, 'achievementId'>[]> {
    this.findCalls += 1;

    if (options.where.userId !== this.userId) {
      return [];
    }

    return this.achievementIds.map((achievementId) => ({ achievementId }));
  }
}

class FakeBadgeRepository {
  findCalls = 0;

  constructor(private readonly badges: Badge[]) {}

  async find(): Promise<Badge[]> {
    this.findCalls += 1;

    return [...this.badges].sort((left, right) => left.ordering - right.ordering);
  }
}

class FakeUserBadgeRepository {
  findCalls = 0;

  constructor(
    private readonly userId: string,
    private readonly badgeIds: string[],
  ) {}

  async find(options: {
    where: { userId: string };
  }): Promise<Pick<UserBadge, 'badgeId'>[]> {
    this.findCalls += 1;

    if (options.where.userId !== this.userId) {
      return [];
    }

    return this.badgeIds.map((badgeId) => ({ badgeId }));
  }
}
