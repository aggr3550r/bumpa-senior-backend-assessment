import { User } from '../../users/entities/user.entity';

export class AchievementUnlockedEvent {
  constructor(
    public readonly achievement_name: string,
    public readonly user: User,
  ) {}
}
