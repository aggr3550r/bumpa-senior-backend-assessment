import { Column, Entity, OneToMany } from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { UserAchievement } from '../../achievements/entities/user-achievement.entity';
import { UserBadge } from '../../badges/entities/user-badge.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';

@Entity({ name: 'users' })
export class User extends TimestampedEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName?: string | null;

  @Column({ name: 'account_number', type: 'varchar', nullable: true })
  accountNumber?: string | null;

  @Column({ name: 'bank_code', type: 'varchar', nullable: true })
  bankCode?: string | null;

  @Column({ name: 'account_name', type: 'varchar', nullable: true })
  accountName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  currency?: string | null;

  @Column({ name: 'payout_recipient_reference', type: 'varchar', nullable: true })
  payoutRecipientReference?: string | null;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.user)
  achievements: UserAchievement[];

  @OneToMany(() => UserBadge, (userBadge) => userBadge.user)
  badges: UserBadge[];

  @OneToMany(() => Purchase, (purchase) => purchase.user)
  purchases: Purchase[];
}
