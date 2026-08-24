export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVELS: string[];
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  DATABASE_SSL: boolean;
  DATABASE_SYNCHRONIZE: boolean;
  PROGRESSION_DEFINITION_LOADERS_ENABLED: boolean;
  PAYSTACK_BASE_URL: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_TRANSFER_SOURCE: string;
  PAYSTACK_CURRENCY: string;
}

const nodeEnvironments = ['development', 'test', 'production'] as const;
const logLevels = ['log', 'error', 'warn', 'debug', 'verbose'] as const;

export function loadEnv(env: Record<string, string | undefined>): Env {
  return {
    NODE_ENV: readEnum(env, 'NODE_ENV', nodeEnvironments, 'development'),
    PORT: readPositiveInteger(env, 'PORT', 3000),
    LOG_LEVELS: readStringList(env, 'LOG_LEVELS', [
      'log',
      'error',
      'warn',
      'debug',
    ]),
    DATABASE_HOST: readString(env, 'DATABASE_HOST', 'localhost'),
    DATABASE_PORT: readPositiveInteger(env, 'DATABASE_PORT', 5432),
    DATABASE_USER: readString(env, 'DATABASE_USER', 'bumpa'),
    DATABASE_PASSWORD: readString(env, 'DATABASE_PASSWORD', 'bumpa'),
    DATABASE_NAME: readString(env, 'DATABASE_NAME', 'bumpa_ecommerce'),
    DATABASE_SSL: readBoolean(env, 'DATABASE_SSL', false),
    DATABASE_SYNCHRONIZE: readBoolean(env, 'DATABASE_SYNCHRONIZE', false),
    PROGRESSION_DEFINITION_LOADERS_ENABLED: readBoolean(
      env,
      'PROGRESSION_DEFINITION_LOADERS_ENABLED',
      true,
    ),
    PAYSTACK_BASE_URL: readUrl(
      env,
      'PAYSTACK_BASE_URL',
      'https://api.paystack.co',
    ),
    PAYSTACK_SECRET_KEY: readString(env, 'PAYSTACK_SECRET_KEY'),
    PAYSTACK_TRANSFER_SOURCE: readString(
      env,
      'PAYSTACK_TRANSFER_SOURCE',
      'balance',
    ),
    PAYSTACK_CURRENCY: readString(env, 'PAYSTACK_CURRENCY', 'NGN'),
  };
}

function readStringList(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string[],
): string[] {
  const value = normalize(env[key]);

  if (value === undefined) {
    return fallback;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error(`${key} must include at least one value`);
  }

  const invalidEntries = entries.filter(
    (entry) => !logLevels.includes(entry as (typeof logLevels)[number]),
  );

  if (invalidEntries.length > 0) {
    throw new Error(`${key} must only include: ${logLevels.join(', ')}`);
  }

  return entries;
}

function readString(
  env: Record<string, string | undefined>,
  key: string,
  fallback?: string,
): string {
  const value = normalize(env[key]) ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readBoolean(
  env: Record<string, string | undefined>,
  key: string,
  fallback: boolean,
): boolean {
  const value = normalize(env[key]);

  if (value === undefined) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${key} must be either "true" or "false"`);
}

function readEnum<T extends readonly string[]>(
  env: Record<string, string | undefined>,
  key: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = normalize(env[key]) ?? fallback;

  if (values.includes(value)) {
    return value;
  }

  throw new Error(`${key} must be one of: ${values.join(', ')}`);
}

function readPositiveInteger(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const value = normalize(env[key]);

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
}

function readUrl(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string,
): string {
  const value = readString(env, key, fallback);

  try {
    new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }

  return value;
}

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
