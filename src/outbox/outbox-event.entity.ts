import { Column, Entity, Index } from 'typeorm';
import { TimestampedEntity } from '../common/entities/timestamped.entity';
import { OutboxEventStatus } from './outbox-event-status.enum';

@Entity({ name: 'outbox_events' })
@Index('IDX_outbox_events_dispatch_order', [
  'status',
  'nextAttemptAt',
  'createdAt',
])
export class OutboxEvent extends TimestampedEntity {
  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ name: 'aggregate_type', type: 'varchar', nullable: true })
  aggregateType?: string | null;

  @Column({ name: 'aggregate_id', type: 'uuid', nullable: true })
  aggregateId?: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxEventStatus,
    default: OutboxEventStatus.Pending,
  })
  status: OutboxEventStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;
}
