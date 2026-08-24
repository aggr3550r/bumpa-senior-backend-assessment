import { User } from '../../users/entities/user.entity';

export class AchievementUnlockedEvent {
  constructor(
    public readonly achievementName: string,
    public readonly user: User,
  ) {}
}
