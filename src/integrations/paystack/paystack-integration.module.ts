import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CASHBACK_PROVIDER } from '../../modules/cashback/providers/cashback-provider.constants';
import { BANK_ACCOUNT_VERIFIER } from '../../modules/users/types/bank-account-verifier.constants';
import { User } from '../../modules/users/entities/user.entity';
import { PaystackBankAccountVerifier } from './bank-account-verification/paystack-bank-account.verifier';
import { PaystackCashbackProvider } from './cashback/paystack-cashback.provider';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    PaystackBankAccountVerifier,
    PaystackCashbackProvider,
    {
      provide: BANK_ACCOUNT_VERIFIER,
      useExisting: PaystackBankAccountVerifier,
    },
    {
      provide: CASHBACK_PROVIDER,
      useExisting: PaystackCashbackProvider,
    },
  ],
  exports: [BANK_ACCOUNT_VERIFIER, CASHBACK_PROVIDER],
})
export class PaystackIntegrationModule {}
