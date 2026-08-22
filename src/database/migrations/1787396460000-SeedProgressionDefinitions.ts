import { MigrationInterface, QueryRunner } from 'typeorm';
import { achievementDefinitions } from '../../modules/achievements/achievement-definitions';
import { badgeDefinitions } from '../../modules/badges/badge-definitions';

export class SeedProgressionDefinitions1787396460000
  implements MigrationInterface
{
  name = 'SeedProgressionDefinitions1787396460000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const achievement of achievementDefinitions) {
      await queryRunner.query(
        `
          INSERT INTO "achievements" ("name", "group", "threshold", "ordering")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("group", "threshold")
          DO UPDATE SET
            "name" = EXCLUDED."name",
            "ordering" = EXCLUDED."ordering",
            "updated_at" = now()
        `,
        [
          achievement.name,
          achievement.group,
          achievement.threshold,
          achievement.ordering,
        ],
      );
    }

    for (const badge of badgeDefinitions) {
      await queryRunner.query(
        `
          INSERT INTO "badges" ("name", "required_achievement_count", "ordering")
          VALUES ($1, $2, $3)
          ON CONFLICT ("name")
          DO UPDATE SET
            "required_achievement_count" = EXCLUDED."required_achievement_count",
            "ordering" = EXCLUDED."ordering",
            "updated_at" = now()
        `,
        [badge.name, badge.requiredAchievementCount, badge.ordering],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "badges" WHERE "name" = ANY($1::text[])`,
      [badgeDefinitions.map((badge) => badge.name)],
    );
    await queryRunner.query(
      `DELETE FROM "achievements" WHERE "name" = ANY($1::text[])`,
      [achievementDefinitions.map((achievement) => achievement.name)],
    );
  }
}
