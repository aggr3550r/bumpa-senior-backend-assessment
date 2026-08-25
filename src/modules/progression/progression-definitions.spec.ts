import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AchievementDefinition,
  BadgeDefinition,
} from './progression-definition.types';

const achievementDefinitions = readJsonResource<AchievementDefinition>(
  'achievement-definitions.json',
);
const badgeDefinitions = readJsonResource<BadgeDefinition>(
  'badge-definitions.json',
);

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

  it('keeps badges aligned to achievement progression order', () => {
    expect(badgeDefinitions.map((badge) => badge.ordering)).toEqual([10, 20]);
    expect(isNonDecreasing(badgeDefinitions)).toBe(true);
  });
});

function readJsonResource<T>(fileName: string): T[] {
  return JSON.parse(
    readFileSync(join(__dirname, '../../resources', fileName), 'utf8'),
  ) as T[];
}

function isNonDecreasing(definitions: BadgeDefinition[]): boolean {
  return definitions.every((definition, index) => {
    const previous = definitions[index - 1];

    return (
      !previous ||
      definition.requiredAchievementCount >= previous.requiredAchievementCount
    );
  });
}
