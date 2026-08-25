import { Module } from '@nestjs/common';
import { AchievementsModule } from '../modules/achievements/achievements.module';
import { BadgesModule } from '../modules/badges/badges.module';
import { CashbackModule } from '../modules/cashback/cashback.module';
import { PurchasesModule } from '../modules/purchases/purchases.module';
import { OutboxModule } from '../outbox/outbox.module';
import { DomainQueueModule } from './domain-queue.module';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { AchievementUnlockedProcessor } from './processors/achievement-unlocked.processor';
import { BadgeUnlockedCashbackProcessor } from './processors/badge-unlocked-cashback.processor';
import { PurchaseCompletedProcessor } from './processors/purchase-completed.processor';

@Module({
  imports: [
    DomainQueueModule,
    OutboxModule,
    AchievementsModule,
    BadgesModule,
    CashbackModule,
    PurchasesModule,
  ],
  providers: [
    OutboxDispatcherService,
    PurchaseCompletedProcessor,
    AchievementUnlockedProcessor,
    BadgeUnlockedCashbackProcessor,
  ],
})
export class DomainWorkersModule {}
