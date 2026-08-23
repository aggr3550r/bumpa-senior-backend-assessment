export interface VerifyBankAccountInput {
  accountNumber: string;
  bankCode: string;
  currency: string;
}

export interface VerifiedBankAccount {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  currency: string;
}

export interface BankAccountVerifier {
  verify(input: VerifyBankAccountInput): Promise<VerifiedBankAccount>;
}
