import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePurchaseDto } from './create-purchase.dto';

describe('CreatePurchaseDto', () => {
  it('coerces numeric string amounts', () => {
    const dto = plainToInstance(CreatePurchaseDto, {
      amount: '1200',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.amount).toBe(1200);
  });

  it('rejects non-positive purchase amounts', () => {
    const dto = plainToInstance(CreatePurchaseDto, {
      amount: 0,
    });

    expect(validateSync(dto)).toHaveLength(1);
  });
});
