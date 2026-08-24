import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from '../badges/entities/badge.entity';
import { UserBadge } from '../badges/entities/user-badge.entity';
import { User } from '../users/entities/user.entity';
import { AchievementEvaluatorService } from './achievement-evaluator.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { EvaluatePurchaseAchievementsListener } from './listeners/evaluate-purchase-achievements.listener';
import { UserAchievementProgressQueryService } from './user-achievement-progress-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      UserAchievement,
      User,
      Badge,
      UserBadge,
    ]),
  ],
  providers: [
    AchievementEvaluatorService,
    EvaluatePurchaseAchievementsListener,
    UserAchievementProgressQueryService,
  ],
  exports: [
    AchievementEvaluatorService,
    UserAchievementProgressQueryService,
    TypeOrmModule,
  ],
})
export class AchievementsModule {}
