import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { BadgeDefinition } from '../../progression/progression-definition.types';
import { Badge } from './entities/badge.entity';

@Injectable()
export class BadgeDefinitionsLoader implements OnApplicationBootstrap {
  private readonly logger = new Logger(BadgeDefinitionsLoader.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Badge)
    private readonly badgeRepository: Repository<Badge>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (
      !this.configService.get<boolean>(
        'PROGRESSION_DEFINITION_LOADERS_ENABLED',
        true,
      )
    ) {
      return;
    }

    const definitions = this.loadDefinitions();

    await this.badgeRepository.manager.transaction(async (manager) => {
      /*
       * Badge definitions are runtime configuration. This transaction lock
       * prevents concurrent app instances from racing while the upsert keeps
       * repeated startup syncs harmless.
       */
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('badge_definitions_loader'))`,
      );

      for (const [index, definition] of definitions.entries()) {
        await manager.query(
          `
            UPDATE "badges"
            SET "ordering" = $2, "updated_at" = now()
            WHERE "name" = $1
          `,
          [definition.name, -100000 - index],
        );
      }

      for (const definition of definitions) {
        await manager.query(
          `
            INSERT INTO "badges" ("name", "required_achievement_count", "ordering")
            VALUES ($1, $2, $3)
            ON CONFLICT ("name")
            DO UPDATE SET
              "required_achievement_count" = EXCLUDED."required_achievement_count",
              "ordering" = EXCLUDED."ordering",
              "updated_at" = now()
          `,
          [
            definition.name,
            definition.requiredAchievementCount,
            definition.ordering,
          ],
        );
      }
    });

    this.logger.log(`Loaded ${definitions.length} badge definitions`);
  }

  private loadDefinitions(): BadgeDefinition[] {
    const resourcePath = join(
      __dirname,
      '../../resources/badge-definitions.json',
    );
    const parsed = JSON.parse(readFileSync(resourcePath, 'utf8')) as unknown;

    return this.validateDefinitions(parsed);
  }

  private validateDefinitions(input: unknown): BadgeDefinition[] {
    if (!Array.isArray(input)) {
      throw new Error('badge-definitions.json must contain an array');
    }

    const names = new Set<string>();
    const orderings = new Set<string>();

    return input.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(`badge definition at index ${index} is invalid`);
      }

      const definition = {
        name: readNonEmptyString(item.name, `badge[${index}].name`),
        requiredAchievementCount: readPositiveInteger(
          item.requiredAchievementCount,
          `badge[${index}].requiredAchievementCount`,
        ),
        ordering: readPositiveInteger(
          item.ordering,
          `badge[${index}].ordering`,
        ),
      };

      assertUnique(names, definition.name, 'badge name');
      assertUnique(orderings, String(definition.ordering), 'badge ordering');

      return definition;
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value.trim();
}

function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer`);
  }

  return value;
}

function assertUnique(values: Set<string>, value: string, label: string): void {
  if (values.has(value)) {
    throw new Error(`Duplicate ${label}: ${value}`);
  }

  values.add(value);
}
