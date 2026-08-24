import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ResponseModel } from '../../models/response.model';
import { UserAchievementProgressQueryService } from './user-achievement-progress-query.service';

@ApiTags('achievements')
@Controller('users/:userId/achievements')
export class AchievementsController {
  constructor(
    private readonly userAchievementProgressQueryService: UserAchievementProgressQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get a user achievement progression summary' })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose achievement progression should be returned.',
    format: 'uuid',
  })
  async getUserAchievementProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const progress =
      await this.userAchievementProgressQueryService.getUserAchievementProgress(
        userId,
      );

    return ResponseModel.success(
      'User achievement progress retrieved successfully',
      progress,
    );
  }
}
