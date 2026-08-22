import { Achievement } from './entities/achievement.entity';

export interface EvaluatePurchaseAchievementsInput {
  userId: string;
  totalCompletedPurchases: number;
}

export interface AchievementEvaluationResult {
  unlockedAchievements: Achievement[];
}
