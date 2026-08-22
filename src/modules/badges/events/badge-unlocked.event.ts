import { User } from '../../users/entities/user.entity';

export class BadgeUnlockedEvent {
  constructor(
    public readonly badge_name: string,
    public readonly user: User,
  ) {}
}
