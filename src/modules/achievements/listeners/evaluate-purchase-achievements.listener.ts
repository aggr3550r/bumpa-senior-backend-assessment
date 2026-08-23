import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PURCHASE_COMPLETED_EVENT } from '../../purchases/events/purchase.events';
import { PurchaseCompletedEvent } from '../../purchases/events/purchase-completed.event';
import { AchievementEvaluatorService } from '../achievement-evaluator.service';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../events/achievement.events';
import { AchievementUnlockedEvent } from '../events/achievement-unlocked.event';

@Injectable()
export class EvaluatePurchaseAchievementsListener {
  constructor(
    private readonly achievementEvaluator: AchievementEvaluatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(PURCHASE_COMPLETED_EVENT)
  async handlePurchaseCompleted(event: PurchaseCompletedEvent): Promise<void> {
    const result =
      await this.achievementEvaluator.evaluatePurchaseAchievements({
        userId: event.user.id,
        totalCompletedPurchases: event.totalCompletedPurchases,
      });

    /*
     * Persist first, emit second. Downstream consumers can treat
     * AchievementUnlocked as a statement that the domain state already exists,
     * not as a request to create it.
     */
    for (const achievement of result.unlockedAchievements) {
      await this.eventEmitter.emitAsync(
        ACHIEVEMENT_UNLOCKED_EVENT,
        new AchievementUnlockedEvent(achievement.name, event.user),
      );
    }
  }
}
