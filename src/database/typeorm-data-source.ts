import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Achievement } from '../modules/achievements/entities/achievement.entity';
import { UserAchievement } from '../modules/achievements/entities/user-achievement.entity';
import { Badge } from '../modules/badges/entities/badge.entity';
import { UserBadge } from '../modules/badges/entities/user-badge.entity';
import { CashbackPayment } from '../modules/cashback/entities/cashback-payment.entity';
import { User } from '../modules/users/entities/user.entity';

config();

const migrationsGlob =
  process.env.NODE_ENV === 'production'
    ? 'dist/database/migrations/*.js'
    : 'src/database/migrations/*.ts';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'bumpa',
  password: process.env.DATABASE_PASSWORD ?? 'bumpa',
  database: process.env.DATABASE_NAME ?? 'bumpa_ecommerce',
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: [
    User,
    Achievement,
    UserAchievement,
    Badge,
    UserBadge,
    CashbackPayment,
  ],
  migrations: [migrationsGlob],
  synchronize: false,
});
