import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it('normalizes email and currency before validation', () => {
    const dto = plainToInstance(CreateUserDto, {
      email: ' ADA@EXAMPLE.COM ',
      bankAccountDetails: {
        accountNumber: '0123456789',
        bankCode: '044',
        accountName: 'Ada Customer',
        currency: 'ngn',
      },
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.email).toBe('ada@example.com');
    expect(dto.bankAccountDetails.currency).toBe('NGN');
  });

  it('rejects invalid email addresses', () => {
    const dto = plainToInstance(CreateUserDto, {
      email: '   ',
      bankAccountDetails: {
        accountNumber: '0123456789',
        bankCode: '044',
        accountName: 'Ada Customer',
        currency: 'NGN',
      },
    });

    expect(validateSync(dto)).toHaveLength(1);
  });

  it('rejects incomplete bank account details', () => {
    const dto = plainToInstance(CreateUserDto, {
      email: 'ada@example.com',
      bankAccountDetails: {
        accountNumber: 'abc',
        bankCode: '',
        accountName: '',
        currency: 'not-a-currency',
      },
    });

    const errors = validateSync(dto);

    expect(errors[0]?.property).toBe('bankAccountDetails');
    expect(errors[0]?.children).toHaveLength(4);
  });
});
