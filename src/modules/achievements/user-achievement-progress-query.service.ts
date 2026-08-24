import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../badges/entities/badge.entity';
import { UserBadge } from '../badges/entities/user-badge.entity';
import { User } from '../users/entities/user.entity';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { UserAchievementProgress } from './types/user-achievement-progress.types';

@Injectable()
export class UserAchievementProgressQueryService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(Badge)
    private readonly badgeRepository: Repository<Badge>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepository: Repository<UserBadge>,
  ) {}

  async getUserAchievementProgress(
    userId: string,
  ): Promise<UserAchievementProgress> {
    const userExists = await this.userRepository.exist({
      where: { id: userId },
    });

    if (!userExists) {
      throw new NotFoundException('user not found');
    }

    const [achievements, userAchievements, badges, userBadges] =
      await Promise.all([
        this.findAchievements(),
        this.findUserAchievements(userId),
        this.findBadges(),
        this.findUserBadges(userId),
      ]);

    const unlockedAchievementIds = new Set(
      userAchievements.map((userAchievement) => userAchievement.achievementId),
    );
    const unlockedBadgeIds = new Set(
      userBadges.map((userBadge) => userBadge.badgeId),
    );
    const unlockedAchievementCount = unlockedAchievementIds.size;
    const currentBadge = this.findCurrentBadge(badges, unlockedBadgeIds);
    const nextBadge = this.findNextBadge(badges, unlockedBadgeIds);

    return {
      unlockedAchievements: this.getUnlockedAchievementNames(
        achievements,
        unlockedAchievementIds,
      ),
      nextAvailableAchievements: this.getNextAvailableAchievementNames(
        achievements,
        unlockedAchievementIds,
      ),
      currentBadge: currentBadge?.name ?? null,
      nextBadge: nextBadge?.name ?? null,
      remainingToUnlockNextBadge: this.calculateRemainingAchievements(
        nextBadge,
        unlockedAchievementCount,
      ),
    };
  }

  private findAchievements(): Promise<Achievement[]> {
    return this.achievementRepository.find({
      order: {
        group: 'ASC',
        ordering: 'ASC',
      },
    });
  }

  private findUserAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId },
      select: {
        achievementId: true,
      },
    });
  }

  private findBadges(): Promise<Badge[]> {
    return this.badgeRepository.find({
      order: {
        ordering: 'ASC',
      },
    });
  }

  private findUserBadges(userId: string): Promise<UserBadge[]> {
    return this.userBadgeRepository.find({
      where: { userId },
      select: {
        badgeId: true,
      },
    });
  }

  private getUnlockedAchievementNames(
    achievements: Achievement[],
    unlockedAchievementIds: Set<string>,
  ): string[] {
    return achievements
      .filter((achievement) => unlockedAchievementIds.has(achievement.id))
      .map((achievement) => achievement.name);
  }

  private getNextAvailableAchievementNames(
    achievements: Achievement[],
    unlockedAchievementIds: Set<string>,
  ): string[] {
    const nextAchievementsByGroup = new Map<string, string>();

    for (const achievement of achievements) {
      if (
        !unlockedAchievementIds.has(achievement.id) &&
        !nextAchievementsByGroup.has(achievement.group)
      ) {
        nextAchievementsByGroup.set(achievement.group, achievement.name);
      }
    }

    return [...nextAchievementsByGroup.values()];
  }

  private findCurrentBadge(
    badges: Badge[],
    unlockedBadgeIds: Set<string>,
  ): Badge | null {
    return (
      [...badges]
        .reverse()
        .find((badge) => unlockedBadgeIds.has(badge.id)) ?? null
    );
  }

  private findNextBadge(
    badges: Badge[],
    unlockedBadgeIds: Set<string>,
  ): Badge | null {
    return badges.find((badge) => !unlockedBadgeIds.has(badge.id)) ?? null;
  }

  private calculateRemainingAchievements(
    nextBadge: Badge | null,
    unlockedAchievementCount: number,
  ): number {
    if (!nextBadge) {
      return 0;
    }

    return Math.max(
      nextBadge.requiredAchievementCount - unlockedAchievementCount,
      0,
    );
  }
}
