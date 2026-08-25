import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { resolveLogLevels } from './log-levels';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: resolveLogLevels(),
  });
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bumpa Ecommerce Store API')
    .setDescription('Achievement, badge, purchase, and cashback demo API.')
    .setVersion('1.0.0')
    .addServer('/v1', 'API v1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(port, () => {
    logger.log(`Server started on port ${port}`);
  });
}

void bootstrap();
