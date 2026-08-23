import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaystackBankAccountVerifier } from './paystack-bank-account.verifier';

describe('PaystackBankAccountVerifier', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves and normalizes the bank account name from Paystack', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        status: true,
        message: 'Account number resolved',
        data: {
          account_number: '0123456789',
          account_name: 'ADA CUSTOMER',
        },
      },
    });
    const verifier = createVerifier();

    await expect(
      verifier.verify({
        accountNumber: '0123456789',
        bankCode: '044',
        currency: 'NGN',
      }),
    ).resolves.toEqual({
      accountNumber: '0123456789',
      bankCode: '044',
      accountName: 'ADA CUSTOMER',
      currency: 'NGN',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/bank/resolve?account_number=0123456789&bank_code=044',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer sk_test_secret',
        },
      },
    );
  });

  it('rejects unresolved bank accounts', async () => {
    mockFetch({
      ok: false,
      body: {
        status: false,
        message: 'Could not resolve account name',
      },
    });
    const verifier = createVerifier();

    await expect(
      verifier.verify({
        accountNumber: '0123456789',
        bankCode: '999',
        currency: 'NGN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps network exceptions to service unavailable', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('connection timeout');
    }) as never;
    const verifier = createVerifier();

    await expect(
      verifier.verify({
        accountNumber: '0123456789',
        bankCode: '044',
        currency: 'NGN',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not call Paystack when credentials are missing', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        status: true,
        data: {
          account_name: 'ADA CUSTOMER',
        },
      },
    });
    const verifier = createVerifier({ PAYSTACK_SECRET_KEY: '' });

    await expect(
      verifier.verify({
        accountNumber: '0123456789',
        bankCode: '044',
        currency: 'NGN',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createVerifier(config: Record<string, string> = {}) {
  const defaults = {
    PAYSTACK_BASE_URL: 'https://api.paystack.co',
    PAYSTACK_SECRET_KEY: 'sk_test_secret',
  };
  const values = {
    ...defaults,
    ...config,
  };

  return new PaystackBankAccountVerifier({
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService);
}

function mockFetch(input: { ok: boolean; body: unknown }) {
  const fetchMock = jest.fn(async () => ({
    ok: input.ok,
    json: jest.fn(async () => input.body),
  }));

  global.fetch = fetchMock as never;

  return fetchMock;
}
