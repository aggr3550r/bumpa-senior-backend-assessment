import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { PURCHASE_ACHIEVEMENT_GROUP } from './types/achievement-definitions';
import {
  AchievementEvaluationResult,
  EvaluatePurchaseAchievementsInput,
} from './types/achievement-evaluation.types';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';

@Injectable()
export class AchievementEvaluatorService {
  private readonly logger = new Logger(AchievementEvaluatorService.name);

  constructor(
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepository: Repository<UserAchievement>,
  ) {}

  async evaluatePurchaseAchievements(
    input: EvaluatePurchaseAchievementsInput,
  ): Promise<AchievementEvaluationResult> {
    this.logger.debug(
      `Evaluating purchase achievements: userId=${input.userId}, totalCompletedPurchases=${input.totalCompletedPurchases}`,
    );

    return this.userAchievementRepository.manager.transaction((manager) =>
      this.evaluateThresholdGroup(
        manager,
        input.userId,
        PURCHASE_ACHIEVEMENT_GROUP,
        input.totalCompletedPurchases,
      ),
    );
  }

  private async evaluateThresholdGroup(
    manager: EntityManager,
    userId: string,
    group: string,
    progress: number,
  ): Promise<AchievementEvaluationResult> {
    const achievementRepository = manager.getRepository(Achievement);
    const userAchievementRepository = manager.getRepository(UserAchievement);

    /*
     * A group is a progression track for one metric, such as purchases.
     * If a user's current progress crosses multiple persisted thresholds at
     * once, all missing achievements up to that progress are unlocked.
     */
    const eligibleAchievements = await achievementRepository.find({
      where: {
        group,
        threshold: LessThanOrEqual(progress),
      },
      order: {
        ordering: 'ASC',
      },
    });
    this.logger.debug(
      `Eligible achievements resolved: userId=${userId}, group=${group}, progress=${progress}, eligibleCount=${eligibleAchievements.length}`,
    );

    const unlockedAchievements: Achievement[] = [];

    for (const achievement of eligibleAchievements) {
      const wasUnlocked = await this.insertUserAchievement(
        userAchievementRepository,
        userId,
        achievement.id,
      );

      if (wasUnlocked) {
        unlockedAchievements.push(achievement);
        this.logger.log(
          `Achievement unlocked: userId=${userId}, achievementId=${achievement.id}, achievementName=${achievement.name}, group=${group}, threshold=${achievement.threshold}`,
        );
      } else {
        this.logger.debug(
          `Achievement already unlocked; skipping duplicate unlock: userId=${userId}, achievementId=${achievement.id}, achievementName=${achievement.name}`,
        );
      }
    }

    this.logger.debug(
      `Purchase achievement evaluation completed: userId=${userId}, group=${group}, newlyUnlockedCount=${unlockedAchievements.length}`,
    );

    return { unlockedAchievements };
  }

  private async insertUserAchievement(
    userAchievementRepository: Repository<UserAchievement>,
    userId: string,
    achievementId: string,
  ): Promise<boolean> {
    /*
     * Duplicate processing is handled by the database uniqueness constraint.
     * The evaluator can therefore be called repeatedly or concurrently without
     * relying on a race-prone find-before-insert check.
     */
    const insertResult = await userAchievementRepository
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        achievementId,
        unlockedAt: new Date(),
      })
      .orIgnore()
      .returning('id')
      .execute();

    return insertResult.raw.length > 0;
  }
}
