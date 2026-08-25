import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACHIEVEMENT_EVENTS_QUEUE,
  BADGE_EVENTS_QUEUE,
  PURCHASE_EVENTS_QUEUE,
} from './domain-queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        prefix: configService.get<string>('BULLMQ_PREFIX', 'bull'),
      }),
    }),
    BullModule.registerQueue(
      { name: PURCHASE_EVENTS_QUEUE },
      { name: ACHIEVEMENT_EVENTS_QUEUE },
      { name: BADGE_EVENTS_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class DomainQueueModule {}
