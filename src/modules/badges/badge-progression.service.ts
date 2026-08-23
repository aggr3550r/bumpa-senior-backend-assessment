import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import {
  BadgeProgressionResult,
  EvaluateBadgeProgressionInput,
} from './types/badge-progression.types';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';

@Injectable()
export class BadgeProgressionService {
  constructor(
    @InjectRepository(UserBadge)
    private readonly userBadgeRepository: Repository<UserBadge>,
  ) {}

  async evaluateBadgeProgression(
    input: EvaluateBadgeProgressionInput,
  ): Promise<BadgeProgressionResult> {
    return this.userBadgeRepository.manager.transaction((manager) =>
      this.evaluateUserProgression(manager, input.userId),
    );
  }

  private async evaluateUserProgression(
    manager: EntityManager,
    userId: string,
  ): Promise<BadgeProgressionResult> {
    const badgeRepository = manager.getRepository(Badge);
    const userBadgeRepository = manager.getRepository(UserBadge);
    const userAchievementRepository = manager.getRepository(UserAchievement);

    /*
     * Badge progression reacts to achievement state, not purchase state.
     * That keeps badge rules independent from how any achievement was earned.
     */
    const unlockedAchievementCount = await userAchievementRepository.count({
      where: { userId },
    });

    const badges = await badgeRepository.find({
      order: {
        ordering: 'ASC',
      },
    });

    const existingUserBadges = await userBadgeRepository.find({
      select: {
        badgeId: true,
      },
      where: { userId },
    });
    const unlockedBadgeIds = new Set(
      existingUserBadges.map((userBadge) => userBadge.badgeId),
    );

    /*
     * Ordering is the persisted progression authority. If a user crosses
     * multiple badge thresholds at once, persist every missing eligible badge
     * so progression has no gaps, then report the highest newly unlocked badge.
     */
    const newlyEligibleBadges = badges.filter(
      (badge) =>
        badge.requiredAchievementCount <= unlockedAchievementCount &&
        !unlockedBadgeIds.has(badge.id),
    );
    const insertedBadges: Badge[] = [];

    for (const badge of newlyEligibleBadges) {
      const insertedBadge = await this.insertUserBadge(
        userBadgeRepository,
        userId,
        badge,
      );

      if (insertedBadge) {
        insertedBadges.push(insertedBadge);
        unlockedBadgeIds.add(insertedBadge.id);
      }
    }

    const newlyUnlockedBadge = insertedBadges.at(-1) ?? null;

    /*
     * Cashback is intentionally absent here. Badge persistence is domain state;
     * payment side effects belong to the later BadgeUnlocked flow.
     */
    const nextBadge =
      badges.find((badge) => !unlockedBadgeIds.has(badge.id)) ?? null;

    return {
      unlockedAchievementCount,
      newlyUnlockedBadge,
      nextBadge,
    };
  }

  private async insertUserBadge(
    userBadgeRepository: Repository<UserBadge>,
    userId: string,
    badge: Badge,
  ): Promise<Badge | null> {
    const insertResult = await userBadgeRepository
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        badgeId: badge.id,
        unlockedAt: new Date(),
      })
      .orIgnore()
      .returning('id')
      .execute();

    return insertResult.raw.length > 0 ? badge : null;
  }
}
