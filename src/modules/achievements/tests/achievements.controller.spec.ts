import { HttpStatus } from '@nestjs/common';
import { AchievementsController } from '../achievements.controller';
import { UserAchievementProgressQueryService } from '../user-achievement-progress-query.service';

describe('AchievementsController', () => {
  it('wraps user achievement progress in the standard response model', async () => {
    const progress = {
      unlockedAchievements: ['First Purchase'],
      nextAvailableAchievements: ['5 Purchases'],
      currentBadge: null,
      nextBadge: 'Starter',
      remainingToUnlockNextBadge: 1,
    };
    const queryService = {
      getUserAchievementProgress: jest.fn(async () => progress),
    };
    const controller = new AchievementsController(
      queryService as unknown as UserAchievementProgressQueryService,
    );
    const userId = '333e9740-59ea-4ec7-b936-93d2a2f86c52';

    await expect(controller.getUserAchievementProgress(userId)).resolves.toEqual(
      {
        status: true,
        statusCode: HttpStatus.OK,
        message: 'User achievement progress retrieved successfully',
        data: progress,
        meta: undefined,
      },
    );
    expect(queryService.getUserAchievementProgress).toHaveBeenCalledWith(userId);
  });
});
