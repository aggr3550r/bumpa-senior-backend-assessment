import { Badge } from '../entities/badge.entity';

export interface EvaluateBadgeProgressionInput {
  userId: string;
}

export interface BadgeProgressionResult {
  unlockedAchievementCount: number;
  newlyUnlockedBadge: Badge | null;
  nextBadge: Badge | null;
}
