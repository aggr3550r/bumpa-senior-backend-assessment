import { AchievementDefinition } from '../../progression/progression-definition.types';

export const PURCHASE_ACHIEVEMENT_GROUP = 'purchases';

export const achievementDefinitions: readonly AchievementDefinition[] = [
  {
    name: 'First Purchase',
    group: PURCHASE_ACHIEVEMENT_GROUP,
    threshold: 1,
    ordering: 10,
  },
  {
    name: '5 Purchases',
    group: PURCHASE_ACHIEVEMENT_GROUP,
    threshold: 5,
    ordering: 20,
  },
] as const;
