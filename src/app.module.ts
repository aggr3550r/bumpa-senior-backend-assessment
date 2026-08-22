import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BadgesModule } from './modules/badges/badges.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
        synchronize: configService.get<string>('DATABASE_SYNCHRONIZE') === 'true',
        ssl:
          configService.get<string>('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    UsersModule,
    AchievementsModule,
    BadgesModule,
    CashbackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
