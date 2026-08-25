import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../../outbox/outbox.module';
import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import { BadgeDefinitionsLoader } from './badge-definitions.loader';
import { BadgeProgressionService } from './badge-progression.service';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Badge, UserBadge, UserAchievement]),
    OutboxModule,
  ],
  providers: [BadgeDefinitionsLoader, BadgeProgressionService],
  exports: [BadgeProgressionService, TypeOrmModule],
})
export class BadgesModule {}
