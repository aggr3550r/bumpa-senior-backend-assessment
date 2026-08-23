import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashbackPaymentService } from './cashback-payment.service';
import { CashbackPayment } from './entities/cashback-payment.entity';
import { ProcessBadgeUnlockedCashbackListener } from './listeners/process-badge-unlocked-cashback.listener';

@Module({
  imports: [TypeOrmModule.forFeature([CashbackPayment])],
  providers: [CashbackPaymentService, ProcessBadgeUnlockedCashbackListener],
  exports: [CashbackPaymentService, TypeOrmModule],
})
export class CashbackModule {}
