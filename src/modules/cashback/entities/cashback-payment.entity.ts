import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { Badge } from '../../badges/entities/badge.entity';
import { User } from '../../users/entities/user.entity';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';

@Entity({ name: 'cashback_payments' })
@Unique('UQ_cashback_payments_user_badge', ['userId', 'badgeId'])
@Index('IDX_cashback_payments_status', ['status'])
export class CashbackPayment extends TimestampedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'badge_id', type: 'uuid' })
  badgeId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ unique: true })
  reference: string;

  @Column()
  provider: string;

  @Column({ name: 'provider_reference', type: 'varchar', nullable: true })
  providerReference?: string | null;

  @Column({
    type: 'enum',
    enum: CashbackPaymentStatus,
    default: CashbackPaymentStatus.Pending,
  })
  status: CashbackPaymentStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Badge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badge_id' })
  badge: Badge;
}
