export interface SendCashbackRequest {
  userId: string;
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
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export interface CashbackProvider {
  sendCashback(request: SendCashbackRequest): Promise<SendCashbackResult>;
}
