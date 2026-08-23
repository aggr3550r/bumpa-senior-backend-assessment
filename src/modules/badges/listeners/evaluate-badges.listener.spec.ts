import { AchievementUnlockedEvent } from '../../achievements/events/achievement-unlocked.event';
import { User } from '../../users/entities/user.entity';
import { BadgeProgressionService } from '../badge-progression.service';
import { EvaluateBadgesListener } from './evaluate-badges.listener';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Badge } from '../entities/badge.entity';
import { BADGE_UNLOCKED_EVENT } from '../events/badge.events';
import { BadgeUnlockedEvent } from '../events/badge-unlocked.event';

describe('EvaluateBadgesListener', () => {
  it('evaluates badge progression when an achievement is unlocked', async () => {
    const { listener, badgeProgression } = createListenerHarness({
      newlyUnlockedBadge: null,
    });
    const user = buildUser();

    await listener.handleAchievementUnlocked(
      new AchievementUnlockedEvent('First Purchase', user),
    );

    expect(badgeProgression.evaluateBadgeProgression).toHaveBeenCalledWith({
      userId: user.id,
    });
  });

  it('emits BadgeUnlocked when a new badge is persisted', async () => {
    const user = buildUser();
    const beginnerBadge = buildBadge({ name: 'Beginner' });
    const { listener, eventEmitter } = createListenerHarness({
      newlyUnlockedBadge: beginnerBadge,
    });

    await listener.handleAchievementUnlocked(
      new AchievementUnlockedEvent('First Purchase', user),
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BADGE_UNLOCKED_EVENT,
      new BadgeUnlockedEvent('Beginner', user),
    );
  });

  it('emits the required badge name and user payload', async () => {
    const user = buildUser();
    const beginnerBadge = buildBadge({ name: 'Beginner' });
    const { listener, eventEmitter } = createListenerHarness({
      newlyUnlockedBadge: beginnerBadge,
    });

    await listener.handleAchievementUnlocked(
      new AchievementUnlockedEvent('First Purchase', user),
    );

    const emittedPayload = (eventEmitter.emit as jest.Mock).mock
      .calls[0][1] as BadgeUnlockedEvent;

    expect(emittedPayload.badge_name).toBe('Beginner');
    expect(emittedPayload.user).toBe(user);
  });

  it('does not emit BadgeUnlocked when no badge was newly persisted', async () => {
    const user = buildUser();
    const { listener, eventEmitter } = createListenerHarness({
      newlyUnlockedBadge: null,
    });

    await listener.handleAchievementUnlocked(
      new AchievementUnlockedEvent('First Purchase', user),
    );

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});

function createListenerHarness(options: { newlyUnlockedBadge: Badge | null }) {
  const badgeProgression = {
    evaluateBadgeProgression: jest.fn(async () => ({
      unlockedAchievementCount: 1,
      newlyUnlockedBadge: options.newlyUnlockedBadge,
      nextBadge: null,
    })),
  };
  const eventEmitter = {
    emit: jest.fn(() => true),
  };
  const listener = new EvaluateBadgesListener(
    badgeProgression as unknown as BadgeProgressionService,
    eventEmitter as unknown as EventEmitter2,
  );

  return {
    badgeProgression,
    eventEmitter,
    listener,
  };
}

function buildUser(): User {
  return {
    id: '6f5d5d0f-aa19-4ee4-908f-4d7b504c9ce7',
    email: 'customer@example.com',
    firstName: 'Ada',
    lastName: 'Customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    achievements: [],
    badges: [],
    purchases: [],
  };
}

function buildBadge(input: { name: string }): Badge {
  return {
    id: 'a5fcafde-7f78-4dfc-955d-6cd787679d19',
    name: input.name,
    requiredAchievementCount: 1,
    ordering: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userBadges: [],
  };
}
