import { User } from '../../users/entities/user.entity';
import { Badge } from '../entities/badge.entity';

export class BadgeUnlockedEvent {
  constructor(
    public readonly badgeName: string,
    public readonly user: User,
    public readonly badge: Badge,
  ) {}
}
