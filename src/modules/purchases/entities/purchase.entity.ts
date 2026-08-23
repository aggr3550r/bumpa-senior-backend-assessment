import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamped.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseStatus } from '../types/purchase-status.enum';

@Entity({ name: 'purchases' })
export class Purchase extends TimestampedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.Completed,
  })
  status: PurchaseStatus;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;

  @ManyToOne(() => User, (user) => user.purchases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
