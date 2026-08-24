import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import { BadgeDefinitionsLoader } from './badge-definitions.loader';
import { BadgeProgressionService } from './badge-progression.service';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { EvaluateBadgesListener } from './listeners/evaluate-badges.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, UserBadge, UserAchievement])],
  providers: [
    BadgeDefinitionsLoader,
    BadgeProgressionService,
    EvaluateBadgesListener,
  ],
  exports: [BadgeProgressionService, TypeOrmModule],
})
export class BadgesModule {}
