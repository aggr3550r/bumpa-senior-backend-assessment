export interface AchievementDefinition {
  name: string;
  group: string;
  threshold: number;
  ordering: number;
}

export interface BadgeDefinition {
  name: string;
  requiredAchievementCount: number;
  ordering: number;
}
