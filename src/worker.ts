import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolveLogLevels } from './log-levels';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule, {
    logger: resolveLogLevels(),
  });
  Logger.log('Queue worker started', 'WorkerApplication');
}

void bootstrap();
