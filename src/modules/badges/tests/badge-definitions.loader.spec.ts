import { ConfigService } from '@nestjs/config';
import { BadgeDefinitionsLoader } from '../badge-definitions.loader';

describe('BadgeDefinitionsLoader', () => {
  it('does not sync definitions when the env knob is disabled', async () => {
    const { loader, repository } = createLoaderHarness({ enabled: false });

    await loader.onApplicationBootstrap();

    expect(repository.manager.transaction).not.toHaveBeenCalled();
  });

  it('uses an advisory lock and upserts badge definitions from JSON', async () => {
    const { loader, manager } = createLoaderHarness({ enabled: true });

    await loader.onApplicationBootstrap();

    expect(manager.queries[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(manager.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          params: ['Starter', -100000],
        }),
        expect.objectContaining({
          params: ['Loyal Customer', -100001],
        }),
        expect.objectContaining({
          params: ['Starter', 2, 10],
        }),
        expect.objectContaining({
          params: ['Loyal Customer', 5, 20],
        }),
      ]),
    );
    expect(
      manager.queries.some((query) =>
        query.sql.includes('ON CONFLICT ("name")'),
      ),
    ).toBe(true);
  });

  it('rejects duplicate badge names', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: 'Starter',
          requiredAchievementCount: 2,
          ordering: 10,
        },
        {
          name: 'Starter',
          requiredAchievementCount: 5,
          ordering: 20,
        },
      ]),
    ).toThrow('Duplicate badge name: Starter');
  });

  it('rejects duplicate badge ordering values', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: 'Starter',
          requiredAchievementCount: 2,
          ordering: 10,
        },
        {
          name: 'Loyal Customer',
          requiredAchievementCount: 5,
          ordering: 10,
        },
      ]),
    ).toThrow('Duplicate badge ordering: 10');
  });

  it('rejects invalid badge definition fields', () => {
    const { loader } = createLoaderHarness({ enabled: true });

    expect(() =>
      validateDefinitions(loader, [
        {
          name: 'Starter',
          requiredAchievementCount: 0,
          ordering: 10,
        },
      ]),
    ).toThrow('badge[0].requiredAchievementCount must be a positive integer');
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
  const loader = new BadgeDefinitionsLoader(
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
  loader: BadgeDefinitionsLoader,
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
