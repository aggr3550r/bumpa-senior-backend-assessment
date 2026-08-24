import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementEvaluatorService } from '../achievement-evaluator.service';
import { Achievement } from '../entities/achievement.entity';
import { EvaluatePurchaseAchievementsListener } from './evaluate-purchase-achievements.listener';
import { PurchaseCompletedEvent } from '../../purchases/events/purchase-completed.event';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../events/achievement.events';
import { AchievementUnlockedEvent } from '../events/achievement-unlocked.event';
import { User } from '../../users/entities/user.entity';

describe('EvaluatePurchaseAchievementsListener', () => {
  const user = buildUser();
  const firstPurchaseAchievement = buildAchievement({
    id: '93472bfa-45df-4094-9c11-b2c4a89d4474',
    name: 'First Purchase',
    threshold: 1,
    ordering: 10,
  });

  it('emits AchievementUnlocked when an achievement is newly persisted', async () => {
    const { listener, eventEmitter } = createListenerHarness({
      unlockedAchievements: [firstPurchaseAchievement],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 1));

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      ACHIEVEMENT_UNLOCKED_EVENT,
      new AchievementUnlockedEvent('First Purchase', user),
    );
  });

  it('emits the required achievement name and user payload', async () => {
    const { listener, eventEmitter } = createListenerHarness({
      unlockedAchievements: [firstPurchaseAchievement],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 1));

    const emittedPayload = (eventEmitter.emitAsync as jest.Mock).mock
      .calls[0][1] as AchievementUnlockedEvent;

    expect(emittedPayload.achievementName).toBe('First Purchase');
    expect(emittedPayload.user).toBe(user);
  });

  it('passes purchase progress to the reusable evaluator', async () => {
    const { listener, achievementEvaluator } = createListenerHarness({
      unlockedAchievements: [firstPurchaseAchievement],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 5));

    expect(
      achievementEvaluator.evaluatePurchaseAchievements,
    ).toHaveBeenCalledWith({
      userId: user.id,
      totalCompletedPurchases: 5,
    });
  });

  it('does not emit when the achievement was already unlocked', async () => {
    const { listener, eventEmitter } = createListenerHarness({
      unlockedAchievements: [],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 5));

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('does not emit below a configured achievement threshold', async () => {
    const { listener, eventEmitter } = createListenerHarness({
      unlockedAchievements: [],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 0));

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('does not emit when persistence fails', async () => {
    const persistenceError = new Error('database insert failed');
    const { listener, eventEmitter } = createListenerHarness({
      evaluationError: persistenceError,
    });

    await expect(
      listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 1)),
    ).rejects.toThrow(persistenceError);

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('emits only after the evaluator has completed persistence', async () => {
    const callOrder: string[] = [];
    const achievementEvaluator = {
      evaluatePurchaseAchievements: jest.fn(async () => {
        callOrder.push('persisted');

        return {
          unlockedAchievements: [firstPurchaseAchievement],
        };
      }),
    };
    const eventEmitter = {
      emitAsync: jest.fn(async () => {
        callOrder.push('emitted');
      }),
    };
    const listener = new EvaluatePurchaseAchievementsListener(
      achievementEvaluator as unknown as AchievementEvaluatorService,
      eventEmitter as unknown as EventEmitter2,
    );

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 1));

    expect(callOrder).toEqual(['persisted', 'emitted']);
  });

  it('emits one event per newly unlocked achievement in progression order', async () => {
    const fivePurchasesAchievement = buildAchievement({
      id: '30e7ea5a-05a6-49dd-96ee-f02413a35789',
      name: '5 Purchases',
      threshold: 5,
      ordering: 20,
    });
    const { listener, eventEmitter } = createListenerHarness({
      unlockedAchievements: [firstPurchaseAchievement, fivePurchasesAchievement],
    });

    await listener.handlePurchaseCompleted(new PurchaseCompletedEvent(user, 5));

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
    expect((eventEmitter.emitAsync as jest.Mock).mock.calls).toEqual([
      [
        ACHIEVEMENT_UNLOCKED_EVENT,
        new AchievementUnlockedEvent('First Purchase', user),
      ],
      [
        ACHIEVEMENT_UNLOCKED_EVENT,
        new AchievementUnlockedEvent('5 Purchases', user),
      ],
    ]);
  });
});

function createListenerHarness(options: {
  unlockedAchievements?: Achievement[];
  evaluationError?: Error;
}) {
  const achievementEvaluator = {
    evaluatePurchaseAchievements: jest.fn(async () => {
      if (options.evaluationError) {
        throw options.evaluationError;
      }

      return {
        unlockedAchievements: options.unlockedAchievements ?? [],
      };
    }),
  };
  const eventEmitter = {
    emitAsync: jest.fn(async () => undefined),
  };
  const listener = new EvaluatePurchaseAchievementsListener(
    achievementEvaluator as unknown as AchievementEvaluatorService,
    eventEmitter as unknown as EventEmitter2,
  );

  return {
    achievementEvaluator,
    eventEmitter,
    listener,
  };
}

function buildUser(): User {
  return {
    id: '2074d25c-f873-4b36-860d-2b93026d07b8',
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

function buildAchievement(input: {
  id: string;
  name: string;
  threshold: number;
  ordering: number;
}): Achievement {
  return {
    id: input.id,
    name: input.name,
    group: 'purchases',
    threshold: input.threshold,
    ordering: input.ordering,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userAchievements: [],
  };
}
