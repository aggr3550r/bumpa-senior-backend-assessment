import { achievementDefinitions } from '../modules/achievements/types/achievement-definitions';
import { badgeDefinitions } from '../modules/badges/types/badge-definitions';

describe('progression definitions', () => {
  it('keeps purchase achievements in deterministic progression order', () => {
    const purchaseAchievements = achievementDefinitions
      .filter((achievement) => achievement.group === 'purchases')
      .sort((left, right) => left.ordering - right.ordering);

    expect(purchaseAchievements.map((achievement) => achievement.name)).toEqual([
      'First Purchase',
      '5 Purchases',
    ]);
  });

  it('does not define duplicate achievement thresholds in the same group', () => {
    const groupThresholds = achievementDefinitions.map(
      (achievement) => `${achievement.group}:${achievement.threshold}`,
    );

    expect(new Set(groupThresholds).size).toBe(groupThresholds.length);
  });

  it('does not invent badge thresholds before assessment data is available', () => {
    expect(badgeDefinitions).toEqual([]);
  });
});
