import { User } from '../../users/entities/user.entity';
import { Badge } from '../entities/badge.entity';

export class BadgeUnlockedEvent {
  constructor(
    public readonly badge_name: string,
    public readonly user: User,
    public readonly badge: Badge,
  ) {}
}
