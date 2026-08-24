import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PURCHASE_COMPLETED_EVENT } from '../../purchases/events/purchase.events';
import { PurchaseCompletedEvent } from '../../purchases/events/purchase-completed.event';
import { AchievementEvaluatorService } from '../achievement-evaluator.service';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../events/achievement.events';
import { AchievementUnlockedEvent } from '../events/achievement-unlocked.event';

@Injectable()
export class EvaluatePurchaseAchievementsListener {
  private readonly logger = new Logger(EvaluatePurchaseAchievementsListener.name);

  constructor(
    private readonly achievementEvaluator: AchievementEvaluatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(PURCHASE_COMPLETED_EVENT)
  async handlePurchaseCompleted(event: PurchaseCompletedEvent): Promise<void> {
    this.logger.log(
      `Purchase completed event received: userId=${event.user.id}, totalCompletedPurchases=${event.totalCompletedPurchases}`,
    );

    const result =
      await this.achievementEvaluator.evaluatePurchaseAchievements({
        userId: event.user.id,
        totalCompletedPurchases: event.totalCompletedPurchases,
      });

    if (result.unlockedAchievements.length === 0) {
      this.logger.debug(
        `No purchase achievements unlocked: userId=${event.user.id}, totalCompletedPurchases=${event.totalCompletedPurchases}`,
      );

      return;
    }

    this.logger.log(
      `Purchase achievements unlocked: userId=${event.user.id}, achievements=${result.unlockedAchievements.map((achievement) => achievement.name).join(', ')}`,
    );

    /*
     * Persist first, emit second. Downstream consumers can treat
     * AchievementUnlocked as a statement that the domain state already exists,
     * not as a request to create it.
     */
    for (const achievement of result.unlockedAchievements) {
      this.logger.debug(
        `Emitting achievement unlocked event: userId=${event.user.id}, achievementId=${achievement.id}, achievementName=${achievement.name}`,
      );

      await this.eventEmitter.emitAsync(
        ACHIEVEMENT_UNLOCKED_EVENT,
        new AchievementUnlockedEvent(achievement.name, event.user),
      );
    }

    this.logger.debug(
      `Achievement unlocked event handlers finished: userId=${event.user.id}, emittedCount=${result.unlockedAchievements.length}`,
    );
  }
}
