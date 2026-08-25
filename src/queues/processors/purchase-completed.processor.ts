import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AchievementEvaluatorService } from '../../modules/achievements/achievement-evaluator.service';
import {
  PURCHASE_COMPLETED_OUTBOX_EVENT,
  PurchaseCompletedOutboxPayload,
} from '../../outbox/outbox-event.types';
import { PURCHASE_EVENTS_QUEUE } from '../domain-queue.constants';

@Injectable()
@Processor(PURCHASE_EVENTS_QUEUE)
export class PurchaseCompletedProcessor extends WorkerHost {
  private readonly logger = new Logger(PurchaseCompletedProcessor.name);

  constructor(private readonly achievementEvaluator: AchievementEvaluatorService) {
    super();
  }

  async process(job: Job<PurchaseCompletedOutboxPayload>): Promise<void> {
    if (job.name !== PURCHASE_COMPLETED_OUTBOX_EVENT) {
      throw new Error(`Unsupported purchase event job: ${job.name}`);
    }

    this.logger.log(
      `Evaluating purchase achievements: userId=${job.data.userId}, purchaseId=${job.data.purchaseId}, totalCompletedPurchases=${job.data.totalCompletedPurchases}`,
    );

    await this.achievementEvaluator.evaluatePurchaseAchievements({
      userId: job.data.userId,
      totalCompletedPurchases: job.data.totalCompletedPurchases,
    });
  }
}
