import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../../achievements/events/achievement.events';
import { AchievementUnlockedEvent } from '../../achievements/events/achievement-unlocked.event';
import { BadgeProgressionService } from '../badge-progression.service';

@Injectable()
export class EvaluateBadgesListener {
  constructor(private readonly badgeProgression: BadgeProgressionService) {}

  @OnEvent(ACHIEVEMENT_UNLOCKED_EVENT)
  async handleAchievementUnlocked(
    event: AchievementUnlockedEvent,
  ): Promise<void> {
    /*
     * Badge progression reacts to AchievementUnlocked because that event means
     * achievement state has already been persisted. Cashback is deliberately
     * not triggered here; payment side effects belong to the BadgeUnlocked flow.
     */
    await this.badgeProgression.evaluateBadgeProgression({
      userId: event.user.id,
    });
  }
}
