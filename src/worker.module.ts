import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from './env';
import { IntegrationsModule } from './integrations/integrations.module';
import { DomainWorkersModule } from './queues/domain-workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: loadEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'bumpa'),
        password: configService.get<string>('DATABASE_PASSWORD', 'bumpa'),
        database: configService.get<string>('DATABASE_NAME', 'bumpa_ecommerce'),
        schema: configService.get<string>('DATABASE_SCHEMA', 'public'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE', false),
        extra: {
          options: `-c search_path=${configService.get<string>('DATABASE_SCHEMA', 'public')},public`,
        },
        ssl:
          configService.get<boolean>('DATABASE_SSL', false)
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    IntegrationsModule,
    DomainWorkersModule,
  ],
})
export class WorkerModule {}
