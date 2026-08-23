import { User } from '../../users/entities/user.entity';

export interface SendCashbackRequest {
  user: User;
  amount: number;
  reference: string;
}

export interface SendCashbackResult {
  provider: string;
  providerReference: string | null;
  status: CashbackProviderTransferStatus;
  failureReason?: string | null;
}

export enum CashbackProviderTransferStatus {
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export interface CashbackProvider {
  sendCashback(request: SendCashbackRequest): Promise<SendCashbackResult>;
}
