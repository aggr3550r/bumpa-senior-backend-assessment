import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { clearInterval, setInterval } from 'node:timers';
import {
  ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
  BADGE_UNLOCKED_OUTBOX_EVENT,
  PURCHASE_COMPLETED_OUTBOX_EVENT,
} from '../outbox/outbox-event.types';
import { OutboxService } from '../outbox/outbox.service';
import {
  ACHIEVEMENT_EVENTS_QUEUE,
  BADGE_EVENTS_QUEUE,
  PURCHASE_EVENTS_QUEUE,
} from './domain-queue.constants';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private isDispatching = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly configService: ConfigService,
    @InjectQueue(PURCHASE_EVENTS_QUEUE)
    private readonly purchaseEventsQueue: Queue,
    @InjectQueue(ACHIEVEMENT_EVENTS_QUEUE)
    private readonly achievementEventsQueue: Queue,
    @InjectQueue(BADGE_EVENTS_QUEUE)
    private readonly badgeEventsQueue: Queue,
  ) {}

  onModuleInit(): void {
    const pollIntervalMs = this.configService.get<number>(
      'OUTBOX_POLL_INTERVAL_MS',
      1000,
    );
    const batchSize = this.configService.get<number>('OUTBOX_BATCH_SIZE', 25);

    this.logger.log(
      `Outbox dispatcher started: pollIntervalMs=${pollIntervalMs}, batchSize=${batchSize}`,
    );

    void this.dispatchOnce();
    this.interval = setInterval(() => void this.dispatchOnce(), pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async dispatchOnce(): Promise<void> {
    if (this.isDispatching) {
      return;
    }

    this.isDispatching = true;

    try {
      const batchSize = this.configService.get<number>('OUTBOX_BATCH_SIZE', 25);
      const events = await this.outbox.claimPublishableBatch(batchSize);

      if (events.length > 0) {
        this.logger.log(`Claimed ${events.length} outbox event(s) for dispatch`);
      }

      for (const event of events) {
        try {
          this.logger.debug(
            `Publishing outbox event to queue: eventId=${event.id}, eventType=${event.eventType}`,
          );

          await this.queueFor(event.eventType).add(event.eventType, event.payload, {
            jobId: event.id,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: false,
            removeOnFail: false,
          });
          await this.outbox.markPublished(event.id);
          this.logger.debug(
            `Outbox event published: eventId=${event.id}, eventType=${event.eventType}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish outbox event: eventId=${event.id}, eventType=${event.eventType}`,
            error instanceof Error ? error.stack : undefined,
          );
          await this.outbox.markFailed(event.id, event.attemptCount, error);
        }
      }
    } finally {
      this.isDispatching = false;
    }
  }

  private queueFor(eventType: string): Queue {
    if (eventType === PURCHASE_COMPLETED_OUTBOX_EVENT) {
      return this.purchaseEventsQueue;
    }

    if (eventType === ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT) {
      return this.achievementEventsQueue;
    }

    if (eventType === BADGE_UNLOCKED_OUTBOX_EVENT) {
      return this.badgeEventsQueue;
    }

    throw new Error(`Unsupported outbox event type: ${eventType}`);
  }
}
