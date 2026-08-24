import { loadEnv } from './env.schema';

describe('loadEnv', () => {
  it('uses project defaults for optional values', () => {
    const env = loadEnv({
      PAYSTACK_SECRET_KEY: 'sk_test_secret',
    });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'bumpa',
      DATABASE_PASSWORD: 'bumpa',
      DATABASE_NAME: 'bumpa_ecommerce',
      DATABASE_SSL: false,
      DATABASE_SYNCHRONIZE: false,
      PROGRESSION_DEFINITION_LOADERS_ENABLED: true,
      PAYSTACK_BASE_URL: 'https://api.paystack.co',
      PAYSTACK_SECRET_KEY: 'sk_test_secret',
      PAYSTACK_TRANSFER_SOURCE: 'balance',
      PAYSTACK_CURRENCY: 'NGN',
    });
  });

  it('coerces numeric and boolean environment variables', () => {
    const env = loadEnv({
      PORT: '8888',
      DATABASE_PORT: '15432',
      DATABASE_SSL: 'true',
      DATABASE_SYNCHRONIZE: 'false',
      PROGRESSION_DEFINITION_LOADERS_ENABLED: 'false',
      PAYSTACK_SECRET_KEY: 'sk_test_secret',
    });

    expect(env.PORT).toBe(8888);
    expect(env.DATABASE_PORT).toBe(15432);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.DATABASE_SYNCHRONIZE).toBe(false);
    expect(env.PROGRESSION_DEFINITION_LOADERS_ENABLED).toBe(false);
  });

  it('rejects missing Paystack credentials', () => {
    expect(() => loadEnv({})).toThrow(
      'Missing required environment variable: PAYSTACK_SECRET_KEY',
    );
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      loadEnv({
        PAYSTACK_BASE_URL: 'not-a-url',
        PAYSTACK_SECRET_KEY: 'sk_test_secret',
      }),
    ).toThrow('PAYSTACK_BASE_URL must be a valid URL');
  });
});
