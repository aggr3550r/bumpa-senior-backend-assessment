export interface UserAchievementProgress {
  unlockedAchievements: string[];
  nextAvailableAchievements: string[];
  currentBadge: string | null;
  nextBadge: string | null;
  remainingToUnlockNextBadge: number;
}
