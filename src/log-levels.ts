import { LogLevel } from '@nestjs/common';

const allowedLogLevels = ['log', 'error', 'warn', 'debug', 'verbose'] as const;

export function resolveLogLevels(
  configuredLevels = process.env.LOG_LEVELS,
): LogLevel[] {
  if (!configuredLevels) {
    return ['log', 'error', 'warn', 'debug'];
  }

  return configuredLevels
    .split(',')
    .map((level) => level.trim())
    .filter((level): level is LogLevel =>
      allowedLogLevels.includes(level as (typeof allowedLogLevels)[number]),
    );
}
