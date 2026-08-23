import { getMetadataArgsStorage } from 'typeorm';
import { CashbackPayment } from '../entities/cashback-payment.entity';
import { CashbackPaymentStatus } from '../types/cashback-payment-status.enum';

describe('CashbackPayment entity', () => {
  it('prevents duplicate cashback entitlements for the same user and badge', () => {
    const uniqueConstraint = getMetadataArgsStorage().uniques.find(
      (unique) =>
        unique.target === CashbackPayment &&
        unique.name === 'UQ_cashback_payments_user_badge',
    );

    expect(uniqueConstraint?.columns).toEqual(['userId', 'badgeId']);
  });

  it('enforces unique provider idempotency references', () => {
    const referenceColumn = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === CashbackPayment &&
        column.propertyName === 'reference',
    );

    expect(referenceColumn?.options.unique).toBe(true);
  });

  it('defaults new records to pending payment state', () => {
    const statusColumn = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === CashbackPayment && column.propertyName === 'status',
    );

    expect(statusColumn?.options.default).toBe(CashbackPaymentStatus.Pending);
  });
});
