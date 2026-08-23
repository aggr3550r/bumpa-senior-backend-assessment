import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBankAccountDetails1787572800000
  implements MigrationInterface
{
  name = 'AddUserBankAccountDetails1787572800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "account_number" character varying,
      ADD COLUMN "bank_code" character varying,
      ADD COLUMN "account_name" character varying,
      ADD COLUMN "currency" character varying,
      ADD COLUMN "payout_recipient_reference" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "payout_recipient_reference",
      DROP COLUMN "currency",
      DROP COLUMN "account_name",
      DROP COLUMN "bank_code",
      DROP COLUMN "account_number"
    `);
  }
}
