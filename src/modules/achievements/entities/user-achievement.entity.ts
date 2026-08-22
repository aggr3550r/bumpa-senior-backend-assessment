import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { User } from '../../users/entities/user.entity';
import { Achievement } from './achievement.entity';

@Entity({ name: 'user_achievements' })
@Unique('UQ_user_achievements_user_achievement', ['userId', 'achievementId'])
@Index(['userId', 'unlockedAt'])
export class UserAchievement extends TimestampedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'achievement_id', type: 'uuid' })
  achievementId: string;

  @Column({ name: 'unlocked_at', type: 'timestamptz' })
  unlockedAt: Date;

  @ManyToOne(() => User, (user) => user.achievements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(
    () => Achievement,
    (achievement) => achievement.userAchievements,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'achievement_id' })
  achievement: Achievement;
}
