import { getMetadataArgsStorage } from 'typeorm';
import { Achievement } from '../achievements/entities/achievement.entity';
import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import { Badge } from '../badges/entities/badge.entity';
import { UserBadge } from '../badges/entities/user-badge.entity';

describe('progression entities', () => {
  it('prevents duplicate achievement unlocks for the same user', () => {
    const uniqueConstraint = getMetadataArgsStorage().uniques.find(
      (unique) =>
        unique.target === UserAchievement &&
        unique.name === 'UQ_user_achievements_user_achievement',
    );

    expect(uniqueConstraint?.columns).toEqual(['userId', 'achievementId']);
  });

  it('prevents duplicate badge unlocks for the same user', () => {
    const uniqueConstraint = getMetadataArgsStorage().uniques.find(
      (unique) =>
        unique.target === UserBadge &&
        unique.name === 'UQ_user_badges_user_badge',
    );

    expect(uniqueConstraint?.columns).toEqual(['userId', 'badgeId']);
  });

  it('supports deterministic achievement group progression', () => {
    const groupOrderingIndex = getMetadataArgsStorage().indices.find(
      (index) =>
        index.target === Achievement &&
        JSON.stringify(index.columns) === JSON.stringify(['group', 'ordering']),
    );

    expect(groupOrderingIndex).toBeDefined();
  });

  it('supports deterministic badge progression', () => {
    const orderingColumn = getMetadataArgsStorage().columns.find(
      (column) => column.target === Badge && column.propertyName === 'ordering',
    );

    expect(orderingColumn?.options.unique).toBe(true);
  });
});
