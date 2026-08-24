import { ConfigService } from '@nestjs/config';
import { AchievementDefinitionsLoader } from '../achievement-definitions.loader';

describe('AchievementDefinitionsLoader', () => {
  it('does not sync definitions when the env knob is disabled', async () => {
    const { loader, repository } = createLoaderHarness({ enabled: false });

    await loader.onApplicationBootstrap();

    expect(repository.manager.transaction).not.toHaveBeenCalled();
  });

  it('uses an advisory lock and upserts achievement definitions from JSON', async () => {
    const { loader, manager } = createLoaderHarness({ enabled: true });

    await loader.onApplicationBootstrap();

    expect(manager.queries[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(manager.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          params: ['First Purchase', 'purchases', 1, 10],
        }),
        expect.objectContaining({
          params: ['5 Purchases', 'purchases', 5, 20],
        }),
      ]),
    );
    expect(manager.queries.some((query) => query.sql.includes('ON CONFLICT ("name")'))).toBe(
      true,
    );
  });

  it('rejects duplicate achievement names', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: 'First Purchase',
          group: 'purchases',
          threshold: 1,
          ordering: 10,
        },
        {
          name: 'First Purchase',
          group: 'reviews',
          threshold: 1,
          ordering: 20,
        },
      ]),
    ).toThrow('Duplicate achievement name: First Purchase');
  });

  it('rejects duplicate achievement group thresholds', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: 'First Purchase',
          group: 'purchases',
          threshold: 1,
          ordering: 10,
        },
        {
          name: 'Opening Purchase',
          group: 'purchases',
          threshold: 1,
          ordering: 20,
        },
      ]),
    ).toThrow('Duplicate achievement group threshold: purchases:1');
  });

  it('rejects invalid achievement definition fields', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: '',
          group: 'purchases',
          threshold: 1,
          ordering: 10,
        },
      ]),
    ).toThrow('achievement[0].name must be a non-empty string');
  });
});

function createLoaderHarness(options: { enabled: boolean }) {
  const manager = new FakeDefinitionManager();
  const repository = {
    manager: {
      transaction: jest.fn((callback) => callback(manager)),
    },
  };
  const configService = {
    get: jest.fn((_key: string, fallback: boolean) => options.enabled ?? fallback),
  };
  const loader = new AchievementDefinitionsLoader(
    configService as unknown as ConfigService,
    repository as never,
  );

  return {
    loader,
    manager,
    repository,
  };
}

function validateDefinitions(
  loader: AchievementDefinitionsLoader,
  input: unknown,
): unknown {
  return (
    loader as unknown as {
      validateDefinitions(input: unknown): unknown;
    }
  ).validateDefinitions(input);
}

class FakeDefinitionManager {
  readonly queries: { sql: string; params?: unknown[] }[] = [];

  async query(sql: string, params?: unknown[]): Promise<void> {
    this.queries.push({ sql, params });
  }
}
