import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BadgeProgressionService } from '../../modules/badges/badge-progression.service';
import {
  ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT,
  AchievementUnlockedOutboxPayload,
} from '../../outbox/outbox-event.types';
import { ACHIEVEMENT_EVENTS_QUEUE } from '../domain-queue.constants';

@Injectable()
@Processor(ACHIEVEMENT_EVENTS_QUEUE)
export class AchievementUnlockedProcessor extends WorkerHost {
  private readonly logger = new Logger(AchievementUnlockedProcessor.name);

  constructor(private readonly badgeProgression: BadgeProgressionService) {
    super();
  }

  async process(job: Job<AchievementUnlockedOutboxPayload>): Promise<void> {
    if (job.name !== ACHIEVEMENT_UNLOCKED_OUTBOX_EVENT) {
      throw new Error(`Unsupported achievement event job: ${job.name}`);
    }

    this.logger.log(
      `Evaluating badge progression: userId=${job.data.userId}, achievementName=${job.data.achievementName}`,
    );

    await this.badgeProgression.evaluateBadgeProgression({
      userId: job.data.userId,
    });
  }
}
