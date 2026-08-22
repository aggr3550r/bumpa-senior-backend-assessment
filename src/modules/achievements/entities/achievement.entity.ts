import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { UserAchievement } from './user-achievement.entity';

@Entity({ name: 'achievements' })
@Index(['group', 'ordering'])
@Index(['group', 'threshold'], { unique: true })
export class Achievement extends TimestampedEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  group: string;

  @Column({ type: 'integer' })
  threshold: number;

  @Column({ type: 'integer' })
  ordering: number;

  @OneToMany(
    () => UserAchievement,
    (userAchievement) => userAchievement.achievement,
  )
  userAchievements: UserAchievement[];
}
