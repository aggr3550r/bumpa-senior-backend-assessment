import { ConfigService } from '@nestjs/config';
import { CashbackProviderTransferStatus } from '../../../modules/cashback/providers/cashback-provider.types';
import { User } from '../../../modules/users/entities/user.entity';
import { PaystackCashbackProvider } from './paystack-cashback.provider';

describe('PaystackCashbackProvider', () => {
  const originalFetch = global.fetch;
  const user = buildUser({ payoutRecipientReference: 'RCP_customer' });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes a successful provider response', async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          message: 'Transfer has been queued',
          data: {
            status: 'success',
            reference: 'cashback_ref',
            transfer_code: 'TRF_123',
          },
        },
      },
    ]);
    const provider = createProvider({ user });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      provider: 'paystack',
      providerReference: 'TRF_123',
      status: CashbackProviderTransferStatus.Succeeded,
      failureReason: null,
    });
  });

  it('sends the correct amount, recipient, and idempotency reference', async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          data: {
            status: 'pending',
            reference: 'cashback_ref',
            transfer_code: 'TRF_123',
          },
        },
      },
    ]);
    const provider = createProvider({ user });

    await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'Cashback:USER:BADGE',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/transfer',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk_test_secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: 30000,
          recipient: 'RCP_customer',
          reference: 'cashback_user_badge',
          reason: 'Badge cashback',
          currency: 'NGN',
        }),
      }),
    );
  });

  it('creates and stores a transfer recipient when the user has no recipient code', async () => {
    const userWithoutRecipientCode = buildUser({
      payoutRecipientReference: null,
    });
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          data: {
            recipient_code: 'RCP_new_customer',
          },
        },
      },
      {
        ok: true,
        body: {
          status: true,
          data: {
            status: 'success',
            transfer_code: 'TRF_123',
          },
        },
      },
    ]);
    const repository = new FakeUserRepository(userWithoutRecipientCode);
    const provider = createProvider({ repository });

    await provider.sendCashback({
      userId: userWithoutRecipientCode.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.paystack.co/transferrecipient',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'nuban',
          name: 'ADA CUSTOMER',
          account_number: '0123456789',
          bank_code: '044',
          currency: 'NGN',
        }),
      }),
    );
    expect(repository.updatedUser).toEqual({
      criteria: { id: userWithoutRecipientCode.id },
      payload: { payoutRecipientReference: 'RCP_new_customer' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.paystack.co/transfer',
      expect.objectContaining({
        body: expect.stringContaining('"recipient":"RCP_new_customer"'),
      }),
    );
  });

  it('maps provider rejection to a failed transfer result', async () => {
    mockFetchSequence([
      {
        ok: false,
        body: {
          status: false,
          message: 'Insufficient balance',
        },
      },
    ]);
    const provider = createProvider({ user });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(result).toEqual({
      provider: 'paystack',
      providerReference: null,
      status: CashbackProviderTransferStatus.Failed,
      failureReason: 'Insufficient balance',
    });
  });

  it('mocks restricted third-party payout success in development', async () => {
    mockFetchSequence([
      {
        ok: false,
        status: 400,
        body: {
          status: false,
          message: 'You cannot initiate third party payouts at this time',
        },
      },
    ]);
    const provider = createProvider({
      user,
      config: {
        NODE_ENV: 'development',
      },
    });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'Cashback:USER:BADGE',
    });

    expect(result).toEqual({
      provider: 'paystack',
      providerReference: 'mock_cashback_user_badge',
      status: CashbackProviderTransferStatus.Succeeded,
      failureReason: null,
    });
  });

  it('does not mock restricted third-party payout failure outside development', async () => {
    mockFetchSequence([
      {
        ok: false,
        status: 400,
        body: {
          status: false,
          message: 'You cannot initiate third party payouts at this time',
        },
      },
    ]);
    const provider = createProvider({
      user,
      config: {
        NODE_ENV: 'production',
      },
    });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(result).toEqual({
      provider: 'paystack',
      providerReference: null,
      status: CashbackProviderTransferStatus.Failed,
      failureReason: 'You cannot initiate third party payouts at this time',
    });
  });

  it('maps network exceptions to a failed transfer result', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('connection timeout');
    }) as never;
    const provider = createProvider({ user });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(result).toEqual({
      provider: 'paystack',
      providerReference: null,
      status: CashbackProviderTransferStatus.Failed,
      failureReason: 'connection timeout',
    });
  });

  it('maps unexpected provider responses to a failed transfer result', async () => {
    mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          message: 'Accepted',
        },
      },
    ]);
    const provider = createProvider({ user });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(result.status).toBe(CashbackProviderTransferStatus.Failed);
    expect(result.failureReason).toBe('Accepted');
  });

  it('loads credentials and base URL from configuration', async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          data: {
            status: 'success',
            transfer_code: 'TRF_123',
          },
        },
      },
    ]);
    const provider = createProvider({
      user,
      config: {
        PAYSTACK_BASE_URL: 'https://paystack.test',
        PAYSTACK_SECRET_KEY: 'sk_test_from_config',
        PAYSTACK_TRANSFER_SOURCE: 'balance',
        PAYSTACK_CURRENCY: 'NGN',
      },
    });

    await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://paystack.test/transfer',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_test_from_config',
        }),
      }),
    );
  });

  it('does not call Paystack when the secret key is missing', async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        body: {
          status: true,
          data: {
            status: 'success',
          },
        },
      },
    ]);
    const provider = createProvider({
      user,
      config: { PAYSTACK_SECRET_KEY: '' },
    });

    const result = await provider.sendCashback({
      userId: user.id,
      amount: 300,
      reference: 'cashback_ref',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe(CashbackProviderTransferStatus.Failed);
    expect(result.failureReason).toBe('Paystack secret key is not configured');
  });
});

function createProvider(input: {
  user?: User | null;
  repository?: FakeUserRepository;
  config?: Record<string, string>;
}) {
  const defaults = {
    NODE_ENV: 'test',
    PAYSTACK_BASE_URL: 'https://api.paystack.co',
    PAYSTACK_SECRET_KEY: 'sk_test_secret',
    PAYSTACK_TRANSFER_SOURCE: 'balance',
    PAYSTACK_CURRENCY: 'NGN',
  };
  const values = {
    ...defaults,
    ...input.config,
  };
  const repository =
    input.repository ?? new FakeUserRepository(input.user ?? null);

  return new PaystackCashbackProvider(
    {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService,
    repository as never,
  );
}

function mockFetchSequence(
  inputs: { ok: boolean; status?: number; body: unknown }[],
) {
  const fetchMock = jest.fn(async () => {
    const input = inputs.shift();

    if (!input) {
      throw new Error('Unexpected fetch call');
    }

    return {
      ok: input.ok,
      status: input.status,
      json: jest.fn(async () => input.body),
    };
  });

  global.fetch = fetchMock as never;

  return fetchMock;
}

function buildUser(input: { payoutRecipientReference: string | null }): User {
  return {
    id: '291444fc-e87a-4a78-aa9d-17cd8d9beaf5',
    email: 'customer@example.com',
    firstName: 'Ada',
    lastName: 'Customer',
    accountNumber: '0123456789',
    bankCode: '044',
    accountName: 'ADA CUSTOMER',
    currency: 'NGN',
    payoutRecipientReference: input.payoutRecipientReference,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    achievements: [],
    badges: [],
    purchases: [],
  };
}

class FakeUserRepository {
  updatedUser?: {
    criteria: unknown;
    payload: unknown;
  };

  constructor(private readonly user: User | null) {}

  async findOne(): Promise<User | null> {
    return this.user;
  }

  async update(criteria: unknown, payload: unknown): Promise<void> {
    this.updatedUser = {
      criteria,
      payload,
    };
  }
}
