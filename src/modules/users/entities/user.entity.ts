import { Column, Entity, OneToMany } from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { UserAchievement } from '../../achievements/entities/user-achievement.entity';
import { UserBadge } from '../../badges/entities/user-badge.entity';

@Entity({ name: 'users' })
export class User extends TimestampedEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName?: string | null;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.user)
  achievements: UserAchievement[];

  @OneToMany(() => UserBadge, (userBadge) => userBadge.user)
  badges: UserBadge[];
}
