import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgressionSchema1787396400000
  implements MigrationInterface
{
  name = 'CreateProgressionSchema1787396400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "first_name" character varying,
        "last_name" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "achievements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "group" character varying NOT NULL,
        "threshold" integer NOT NULL,
        "ordering" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_achievements_name" UNIQUE ("name"),
        CONSTRAINT "UQ_achievements_group_threshold" UNIQUE ("group", "threshold"),
        CONSTRAINT "PK_achievements_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_achievements_group_ordering"
      ON "achievements" ("group", "ordering")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_achievements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "achievement_id" uuid NOT NULL,
        "unlocked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_user_achievements_user_achievement" UNIQUE ("user_id", "achievement_id"),
        CONSTRAINT "PK_user_achievements_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_achievements_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_achievements_achievement_id" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_achievements_user_unlocked_at"
      ON "user_achievements" ("user_id", "unlocked_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "required_achievement_count" integer NOT NULL,
        "ordering" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_badges_name" UNIQUE ("name"),
        CONSTRAINT "UQ_badges_ordering" UNIQUE ("ordering"),
        CONSTRAINT "PK_badges_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "badge_id" uuid NOT NULL,
        "unlocked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_user_badges_user_badge" UNIQUE ("user_id", "badge_id"),
        CONSTRAINT "PK_user_badges_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_badges_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_badges_badge_id" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_badges_user_unlocked_at"
      ON "user_badges" ("user_id", "unlocked_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_badges_user_unlocked_at"`);
    await queryRunner.query(`DROP TABLE "user_badges"`);
    await queryRunner.query(`DROP TABLE "badges"`);
    await queryRunner.query(`DROP INDEX "IDX_user_achievements_user_unlocked_at"`);
    await queryRunner.query(`DROP TABLE "user_achievements"`);
    await queryRunner.query(`DROP INDEX "IDX_achievements_group_ordering"`);
    await queryRunner.query(`DROP TABLE "achievements"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
