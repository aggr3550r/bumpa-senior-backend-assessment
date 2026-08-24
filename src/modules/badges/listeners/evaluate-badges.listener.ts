import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../../achievements/events/achievement.events';
import { AchievementUnlockedEvent } from '../../achievements/events/achievement-unlocked.event';
import { BadgeProgressionService } from '../badge-progression.service';
import { BADGE_UNLOCKED_EVENT } from '../events/badge.events';
import { BadgeUnlockedEvent } from '../events/badge-unlocked.event';

@Injectable()
export class EvaluateBadgesListener {
  private readonly logger = new Logger(EvaluateBadgesListener.name);

  constructor(
    private readonly badgeProgression: BadgeProgressionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(ACHIEVEMENT_UNLOCKED_EVENT)
  async handleAchievementUnlocked(
    event: AchievementUnlockedEvent,
  ): Promise<void> {
    this.logger.log(
      `Achievement unlocked event received: userId=${event.user.id}, achievementName=${event.achievementName}`,
    );

    /*
     * Badge progression reacts to AchievementUnlocked because that event means
     * achievement state has already been persisted. Cashback is deliberately
     * not triggered here; payment side effects belong to the BadgeUnlocked flow.
     */
    const result = await this.badgeProgression.evaluateBadgeProgression({
      userId: event.user.id,
    });

    /*
     * BadgeUnlocked is the boundary between badge domain state and external
     * side effects. Cashback processing should react to this event later.
     */
    if (result.newlyUnlockedBadge) {
      this.logger.log(
        `Badge unlocked from achievement progression: userId=${event.user.id}, badgeId=${result.newlyUnlockedBadge.id}, badgeName=${result.newlyUnlockedBadge.name}, unlockedAchievementCount=${result.unlockedAchievementCount}`,
      );
      this.logger.debug(
        `Emitting badge unlocked event: userId=${event.user.id}, badgeId=${result.newlyUnlockedBadge.id}, badgeName=${result.newlyUnlockedBadge.name}`,
      );

      await this.eventEmitter.emitAsync(
        BADGE_UNLOCKED_EVENT,
        new BadgeUnlockedEvent(
          result.newlyUnlockedBadge.name,
          event.user,
          result.newlyUnlockedBadge,
        ),
      );

      this.logger.debug(
        `Badge unlocked event handlers finished: userId=${event.user.id}, badgeId=${result.newlyUnlockedBadge.id}`,
      );

      return;
    }

    this.logger.debug(
      `No badge unlocked from achievement event: userId=${event.user.id}, achievementName=${event.achievementName}, unlockedAchievementCount=${result.unlockedAchievementCount}, nextBadge=${result.nextBadge?.name ?? 'none'}`,
    );
  }
}
