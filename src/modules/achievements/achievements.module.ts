import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementEvaluatorService } from './achievement-evaluator.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Achievement, UserAchievement])],
  providers: [AchievementEvaluatorService],
  exports: [AchievementEvaluatorService, TypeOrmModule],
})
export class AchievementsModule {}
