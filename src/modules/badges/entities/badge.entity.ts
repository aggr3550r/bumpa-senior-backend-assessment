import { Column, Entity, OneToMany } from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { UserBadge } from './user-badge.entity';

@Entity({ name: 'badges' })
export class Badge extends TimestampedEntity {
  @Column({ unique: true })
  name: string;

  @Column({ name: 'required_achievement_count', type: 'integer' })
  requiredAchievementCount: number;

  @Column({ type: 'integer', unique: true })
  ordering: number;

  @OneToMany(() => UserBadge, (userBadge) => userBadge.badge)
  userBadges: UserBadge[];
}
