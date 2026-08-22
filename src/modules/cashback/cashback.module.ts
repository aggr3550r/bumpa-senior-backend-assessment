import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashbackPayment } from './entities/cashback-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashbackPayment])],
  exports: [TypeOrmModule],
})
export class CashbackModule {}
