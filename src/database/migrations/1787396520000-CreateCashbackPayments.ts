import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCashbackPayments1787396520000
  implements MigrationInterface
{
  name = 'CreateCashbackPayments1787396520000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "cashback_payments_status_enum" AS ENUM (
        'pending',
        'processing',
        'succeeded',
        'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "cashback_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "badge_id" uuid NOT NULL,
        "amount" integer NOT NULL,
        "reference" character varying NOT NULL,
        "provider" character varying NOT NULL,
        "provider_reference" character varying,
        "status" "cashback_payments_status_enum" NOT NULL DEFAULT 'pending',
        "failure_reason" text,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_cashback_payments_user_badge" UNIQUE ("user_id", "badge_id"),
        CONSTRAINT "UQ_cashback_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_cashback_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cashback_payments_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cashback_payments_badge_id" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cashback_payments_status"
      ON "cashback_payments" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_cashback_payments_status"`);
    await queryRunner.query(`DROP TABLE "cashback_payments"`);
    await queryRunner.query(`DROP TYPE "cashback_payments_status_enum"`);
  }
}
