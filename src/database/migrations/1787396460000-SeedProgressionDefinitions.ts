import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedProgressionDefinitions1787396460000
  implements MigrationInterface
{
  name = 'SeedProgressionDefinitions1787396460000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    /*
     * Progression definitions are now loaded from JSON resources at app
     * startup. This historical migration intentionally stays present so
     * existing migration history remains stable.
     */
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
