import { AchievementUnlockedEvent } from '../../achievements/events/achievement-unlocked.event';
import { User } from '../../users/entities/user.entity';
import { BadgeProgressionService } from '../badge-progression.service';
import { EvaluateBadgesListener } from './evaluate-badges.listener';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EvaluateBadgesListener', () => {
  it('evaluates badge progression when an achievement is unlocked', async () => {
    const badgeProgression = {
      evaluateBadgeProgression: jest.fn(async () => ({
        unlockedAchievementCount: 1,
        newlyUnlockedBadge: null,
        nextBadge: null,
      })),
    };
    const listener = new EvaluateBadgesListener(
      badgeProgression as unknown as BadgeProgressionService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const user = buildUser();

    await listener.handleAchievementUnlocked(
      new AchievementUnlockedEvent('First Purchase', user),
    );

    expect(badgeProgression.evaluateBadgeProgression).toHaveBeenCalledWith({
      userId: user.id,
    });
  });
});

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
  };
}
