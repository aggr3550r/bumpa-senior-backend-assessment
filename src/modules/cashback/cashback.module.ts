import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashbackPaymentService } from './cashback-payment.service';
import { CashbackPayment } from './entities/cashback-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashbackPayment])],
  providers: [CashbackPaymentService],
  exports: [CashbackPaymentService, TypeOrmModule],
})
export class CashbackModule {}
