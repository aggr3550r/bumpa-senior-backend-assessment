import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from './env';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BadgesModule } from './modules/badges/badges.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: loadEnv,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'bumpa'),
        password: configService.get<string>('DATABASE_PASSWORD', 'bumpa'),
        database: configService.get<string>('DATABASE_NAME', 'bumpa_ecommerce'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE', false),
        ssl:
          configService.get<boolean>('DATABASE_SSL', false)
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    IntegrationsModule,
    UsersModule,
    AchievementsModule,
    BadgesModule,
    CashbackModule,
    PurchasesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
