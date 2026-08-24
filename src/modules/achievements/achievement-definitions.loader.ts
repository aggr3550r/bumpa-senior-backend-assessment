import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { AchievementDefinition } from '../../progression/progression-definition.types';
import { Achievement } from './entities/achievement.entity';

@Injectable()
export class AchievementDefinitionsLoader implements OnApplicationBootstrap {
  private readonly logger = new Logger(AchievementDefinitionsLoader.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (
      !this.configService.get<boolean>(
        'PROGRESSION_DEFINITION_LOADERS_ENABLED',
        true,
      )
    ) {
      this.logger.log('Achievement definitions loader disabled by configuration');

      return;
    }

    const definitions = this.loadDefinitions();
    this.logger.log(
      `Syncing achievement definitions from resource file: count=${definitions.length}`,
    );

    await this.achievementRepository.manager.transaction(async (manager) => {
      /*
       * The loader may run on several app instances during deploys. A database
       * advisory lock serializes definition sync, while ON CONFLICT keeps the
       * write idempotent if the same JSON is loaded repeatedly.
       */
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('achievement_definitions_loader'))`,
      );

      for (const definition of definitions) {
        await manager.query(
          `
            INSERT INTO "achievements" ("name", "group", "threshold", "ordering")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name")
            DO UPDATE SET
              "group" = EXCLUDED."group",
              "threshold" = EXCLUDED."threshold",
              "ordering" = EXCLUDED."ordering",
              "updated_at" = now()
          `,
          [
            definition.name,
            definition.group,
            definition.threshold,
            definition.ordering,
          ],
        );
      }
    });

    this.logger.log(`Loaded ${definitions.length} achievement definitions`);
  }

  private loadDefinitions(): AchievementDefinition[] {
    const resourcePath = join(
      __dirname,
      '../../resources/achievement-definitions.json',
    );
    const parsed = JSON.parse(readFileSync(resourcePath, 'utf8')) as unknown;

    return this.validateDefinitions(parsed);
  }

  private validateDefinitions(input: unknown): AchievementDefinition[] {
    if (!Array.isArray(input)) {
      throw new Error('achievement-definitions.json must contain an array');
    }

    const names = new Set<string>();
    const groupThresholds = new Set<string>();

    return input.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(`achievement definition at index ${index} is invalid`);
      }

      const definition = {
        name: readNonEmptyString(item.name, `achievement[${index}].name`),
        group: readNonEmptyString(item.group, `achievement[${index}].group`),
        threshold: readPositiveInteger(
          item.threshold,
          `achievement[${index}].threshold`,
        ),
        ordering: readPositiveInteger(
          item.ordering,
          `achievement[${index}].ordering`,
        ),
      };
      const groupThreshold = `${definition.group}:${definition.threshold}`;

      assertUnique(names, definition.name, 'achievement name');
      assertUnique(
        groupThresholds,
        groupThreshold,
        'achievement group threshold',
      );

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
