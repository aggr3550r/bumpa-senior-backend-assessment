import { Module } from '@nestjs/common';
import { PaystackIntegrationModule } from './paystack/paystack-integration.module';

@Module({
  imports: [PaystackIntegrationModule],
})
export class IntegrationsModule {}
