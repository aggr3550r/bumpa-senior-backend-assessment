import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { createServer, Server } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { PaystackBankAccountVerifier } from '../src/integrations/paystack/bank-account-verification/paystack-bank-account.verifier';
import { BANK_ACCOUNT_VERIFIER } from '../src/modules/users/types/bank-account-verifier.constants';
import { BankAccountVerifier } from '../src/modules/users/types/bank-account-verifier.types';
import { CashbackPaymentStatus } from '../src/modules/cashback/types/cashback-payment-status.enum';

jest.setTimeout(30_000);

describe('Bumpa ecommerce application integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let integrationSchemaName: string;
  let bankAccountVerifier: jest.Mocked<BankAccountVerifier>;
  let paystackServer: Server;
  const paystackRequests: PaystackRequest[] = [];

  beforeAll(async () => {
    try {
      integrationSchemaName = await configureIntegrationEnvironment();

      bankAccountVerifier = {
        verify: jest.fn(async (input) => ({
          accountNumber: input.accountNumber,
          bankCode: input.bankCode,
          accountName: 'TEST VERIFIED ACCOUNT',
          currency: input.currency,
        })),
      };
      paystackServer = await startFakePaystackServer(paystackRequests);
      const { AppModule } = await import('../src/app.module');

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(BANK_ACCOUNT_VERIFIER)
        .useValue(bankAccountVerifier)
        .overrideProvider(PaystackBankAccountVerifier)
        .useValue(bankAccountVerifier)
        .compile();

      app = moduleFixture.createNestApplication({ logger: false });
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );

      await app.init();
      dataSource = app.get(DataSource);

      expect((dataSource.options as { schema?: string }).schema).toBe(
        integrationSchemaName,
      );
    } catch (error) {
      throw new Error(
        `Failed to boot integration app: ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );
    }
  });

  beforeEach(async () => {
    bankAccountVerifier.verify.mockClear();
    paystackRequests.length = 0;
    await resetMutableTables(dataSource);
  });

  afterAll(async () => {
    await app?.close();
    await closeServer(paystackServer);
    await dropIntegrationSchema(integrationSchemaName);
  });

  it('creates and lists users through the HTTP API with verified bank details', async () => {
    const response = await createUser('ADA@Example.COM');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: true,
      statusCode: 201,
      message: 'User created successfully',
      data: {
        email: 'ada@example.com',
        accountName: 'TEST VERIFIED ACCOUNT',
        payoutRecipientReference: null,
      },
    });
    expect(bankAccountVerifier.verify).toHaveBeenCalledWith({
      accountNumber: '0123456789',
      bankCode: '044',
      currency: 'NGN',
    });

    const listResponse = await request(app.getHttpServer()).get('/v1/users');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]).toMatchObject({
      id: response.body.data.id,
      email: 'ada@example.com',
      accountName: 'TEST VERIFIED ACCOUNT',
    });
  });

  it('returns API errors for duplicate users, invalid payloads, and missing users', async () => {
    await createUser('duplicate@example.com').expect(201);

    await createUser('DUPLICATE@example.com').expect(409);
    await request(app.getHttpServer())
      .post('/v1/users')
      .send({ email: 'not-an-email' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/users/8bc46164-5b52-4392-a819-774adc111890/achievements')
      .expect(404);
  });

  it('processes the full purchase achievement, badge, and cashback flow asynchronously', async () => {
    const userId = (await createUser('reward-flow@example.com')).body.data.id;

    await request(app.getHttpServer())
      .post(`/v1/users/${userId}/purchases`)
      .send({ amount: 1500 })
      .expect(201);

    await waitForProgress(userId, (progress) =>
      progress.unlockedAchievements.includes('First Purchase'),
    );

    let progress = await getProgress(userId);

    expect(progress).toMatchObject({
      unlockedAchievements: ['First Purchase'],
      nextAvailableAchievements: ['5 Purchases'],
      currentBadge: null,
      nextBadge: 'Starter',
      remainingToUnlockNextBadge: 1,
    });

    for (let index = 0; index < 3; index += 1) {
      await request(app.getHttpServer())
        .post(`/v1/users/${userId}/purchases`)
        .send({ amount: 1500 })
        .expect(201);
    }

    await assertEventually(async () => {
      const intermediateProgress = await getProgress(userId);

      expect(intermediateProgress.unlockedAchievements).toEqual([
        'First Purchase',
      ]);
      expect(intermediateProgress.currentBadge).toBeNull();
      expect(paystackRequests).toHaveLength(0);
    });

    await request(app.getHttpServer())
      .post(`/v1/users/${userId}/purchases`)
      .send({ amount: 1500 })
      .expect(201);

    progress = await waitForProgress(
      userId,
      (latestProgress) => latestProgress.currentBadge === 'Starter',
    );
    const cashbackPayment = await waitForCashbackPayment(userId);

    expect(progress).toEqual({
      unlockedAchievements: ['First Purchase', '5 Purchases'],
      nextAvailableAchievements: [],
      currentBadge: 'Starter',
      nextBadge: 'Loyal Customer',
      remainingToUnlockNextBadge: 3,
    });
    expect(cashbackPayment).toMatchObject({
      user_id: userId,
      amount: 300,
      provider: 'paystack',
      provider_reference: 'TRF_integration',
      status: CashbackPaymentStatus.Succeeded,
      failure_reason: null,
    });
    const recipientRequest = findPaystackRequest('/transferrecipient');
    const transferRequest = findPaystackRequest('/transfer');

    expect(recipientRequest.body).toMatchObject({
      type: 'nuban',
      name: 'TEST VERIFIED ACCOUNT',
      account_number: '0123456789',
      bank_code: '044',
      currency: 'NGN',
    });
    expect(transferRequest.body).toMatchObject({
      source: 'balance',
      amount: 30000,
      recipient: 'RCP_integration',
      reason: 'Badge cashback',
      currency: 'NGN',
    });
    expect(transferRequest.body.reference).toEqual(
      expect.stringMatching(/^cashback_/),
    );

    const outboxCounts = await dataSource.query(`
      SELECT event_type, COUNT(*)::int AS count
      FROM ${tablePath(dataSource, 'outbox_events')}
      GROUP BY event_type
      ORDER BY event_type ASC
    `);

    expect(outboxCounts).toEqual(
      expect.arrayContaining([
        { event_type: 'achievement.unlocked', count: 2 },
        { event_type: 'badge.unlocked', count: 1 },
        { event_type: 'purchase.completed', count: 5 },
      ]),
    );
  });

  function createUser(email: string) {
    return request(app.getHttpServer())
      .post('/v1/users')
      .send({
        email,
        firstName: 'Ada',
        lastName: 'Customer',
        bankAccountDetails: {
          accountNumber: '0123456789',
          bankCode: '044',
          accountName: 'Ada Customer',
          currency: 'ngn',
        },
      });
  }

  async function getProgress(userId: string): Promise<UserProgressResponse> {
    const response = await request(app.getHttpServer())
      .get(`/v1/users/${userId}/achievements`)
      .expect(200);

    return response.body.data as UserProgressResponse;
  }

  async function waitForProgress(
    userId: string,
    predicate: (progress: UserProgressResponse) => boolean,
  ): Promise<UserProgressResponse> {
    return waitFor(async () => {
      const progress = await getProgress(userId);

      return predicate(progress) ? progress : null;
    });
  }

  async function waitForCashbackPayment(userId: string) {
    return waitFor(async () => {
      const rows = await dataSource.query(
        `
          SELECT user_id, badge_id, amount, reference, provider, provider_reference, status, failure_reason
          FROM ${tablePath(dataSource, 'cashback_payments')}
          WHERE user_id = $1
        `,
        [userId],
      );

      const payment = rows[0] as CashbackPaymentRow | undefined;

      return payment?.status === CashbackPaymentStatus.Succeeded ||
        payment?.status === CashbackPaymentStatus.Failed
        ? payment
        : null;
    });
  }

  function findPaystackRequest(path: string): PaystackRequest {
    const paystackRequest = paystackRequests.find((recordedRequest) =>
      recordedRequest.path.endsWith(path),
    );

    if (!paystackRequest) {
      throw new Error(`Expected Paystack request to ${path}`);
    }

    return paystackRequest;
  }
});

interface UserProgressResponse {
  unlockedAchievements: string[];
  nextAvailableAchievements: string[];
  currentBadge: string | null;
  nextBadge: string | null;
  remainingToUnlockNextBadge: number;
}

interface CashbackPaymentRow {
  user_id: string;
  badge_id: string;
  amount: number;
  reference: string;
  provider: string;
  provider_reference: string | null;
  status: CashbackPaymentStatus;
  failure_reason: string | null;
}

interface PaystackRequest {
  path: string;
  body: Record<string, unknown>;
}

async function configureIntegrationEnvironment(): Promise<string> {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_HOST ??= 'localhost';
  process.env.DATABASE_PORT ??= '5432';
  process.env.DATABASE_USER ??= 'bumpa';
  process.env.DATABASE_PASSWORD ??= 'bumpa';
  process.env.DATABASE_NAME ??= 'bumpa_ecommerce';
  const integrationSchemaName = `integration_${process.pid}`;

  await recreateIntegrationSchema(integrationSchemaName);

  process.env.DATABASE_SCHEMA = integrationSchemaName;
  process.env.DATABASE_SYNCHRONIZE = 'true';
  process.env.REDIS_HOST ??= 'localhost';
  process.env.REDIS_PORT ??= '6379';
  process.env.BULLMQ_PREFIX = `integration-${process.pid}`;
  process.env.OUTBOX_POLL_INTERVAL_MS = '50';
  process.env.OUTBOX_BATCH_SIZE = '25';
  process.env.PAYSTACK_SECRET_KEY ??= 'test_paystack_secret_key';
  process.env.PROGRESSION_DEFINITION_LOADERS_ENABLED = 'true';

  return integrationSchemaName;
}

async function recreateIntegrationSchema(schemaName: string): Promise<void> {
  const adminDataSource = await createAdminDataSource();

  try {
    await adminDataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminDataSource.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await adminDataSource.destroy();
  }
}

async function dropIntegrationSchema(schemaName: string): Promise<void> {
  if (!schemaName) {
    return;
  }

  const adminDataSource = await createAdminDataSource();

  try {
    await adminDataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await adminDataSource.destroy();
  }
}

async function createAdminDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  await dataSource.initialize();

  return dataSource;
}

async function startFakePaystackServer(
  requests: PaystackRequest[],
): Promise<Server> {
  const server = createServer((requestMessage, responseMessage) => {
    void (async () => {
      const body = await readJsonBody(requestMessage);
      const path = requestMessage.url ?? '';

      requests.push({ path, body });

      if (path === '/transferrecipient') {
        responseMessage.writeHead(200, { 'Content-Type': 'application/json' });
        responseMessage.end(
          JSON.stringify({
            status: true,
            message: 'Recipient created',
            data: {
              recipient_code: 'RCP_integration',
            },
          }),
        );

        return;
      }

      if (path === '/transfer') {
        responseMessage.writeHead(200, { 'Content-Type': 'application/json' });
        responseMessage.end(
          JSON.stringify({
            status: true,
            message: 'Transfer queued',
            data: {
              status: 'success',
              transfer_code: 'TRF_integration',
            },
          }),
        );

        return;
      }

      responseMessage.writeHead(404, { 'Content-Type': 'application/json' });
      responseMessage.end(
        JSON.stringify({
          status: false,
          message: `Unhandled fake Paystack path: ${path}`,
        }),
      );
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Fake Paystack server did not expose a TCP port');
  }

  process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${address.port}`;

  return server;
}

async function readJsonBody(requestMessage: {
  [Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
}): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of requestMessage) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  return rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}


async function resetMutableTables(dataSource: DataSource): Promise<void> {
  const mutableTables = [
    'cashback_payments',
    'user_badges',
    'user_achievements',
    'purchases',
    'outbox_events',
    'users',
  ]
    .map((tableName) => tablePath(dataSource, tableName))
    .join(', ');

  try {
    await dataSource.query(`
      TRUNCATE TABLE ${mutableTables}
      RESTART IDENTITY CASCADE
    `);
  } catch (error) {
    throw new Error(
      `Failed to reset integration tables: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function tablePath(dataSource: DataSource, tableName: string): string {
  const schema = String(
    (dataSource.options as { schema?: string }).schema ?? 'public',
  );

  return `"${schema}"."${tableName}"`;
}

async function assertEventually(assertion: () => Promise<void>): Promise<void> {
  await waitFor(async () => {
    try {
      await assertion();

      return true;
    } catch {
      return null;
    }
  });
}

async function waitFor<T>(
  callback: () => Promise<T | null>,
  timeoutMs = 10_000,
  intervalMs = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await callback();

    if (result !== null) {
      return result;
    }

    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for integration condition');
}
