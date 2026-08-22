import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAchievement } from '../achievements/entities/user-achievement.entity';
import { BadgeProgressionService } from './badge-progression.service';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, UserBadge, UserAchievement])],
  providers: [BadgeProgressionService],
  exports: [BadgeProgressionService, TypeOrmModule],
})
export class BadgesModule {}
