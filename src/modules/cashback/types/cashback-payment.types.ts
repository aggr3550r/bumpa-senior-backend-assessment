import { CashbackPayment } from '../entities/cashback-payment.entity';

export interface CreateCashbackPaymentInput {
  userId: string;
  badgeId: string;
  amount: number;
  provider: string;
}

export interface CreateCashbackPaymentResult {
  payment: CashbackPayment;
  created: boolean;
}

export interface RecordCashbackProviderResultInput {
  paymentId: string;
  provider: string;
  providerReference?: string | null;
  status: CashbackPayment['status'];
  failureReason?: string | null;
}
