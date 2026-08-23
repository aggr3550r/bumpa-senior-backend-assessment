import { HttpStatus } from '@nestjs/common';
import { PurchasesController } from '../purchases.controller';
import { PurchasesService } from '../purchases.service';

describe('PurchasesController', () => {
  it('wraps created purchases in a response model', async () => {
    const result = {
      purchase: {
        id: 'ba55d738-849c-489c-9935-1e387e460507',
        amount: 1200,
      },
      totalCompletedPurchases: 1,
    };
    const controller = new PurchasesController({
      createCompletedPurchase: jest.fn(async () => result),
    } as unknown as PurchasesService);

    await expect(
      controller.createCompletedPurchase(
        '57caaeb4-97bb-4673-97c0-5e8c9d64ca50',
        { amount: 1200 },
      ),
    ).resolves.toEqual({
      status: true,
      statusCode: HttpStatus.CREATED,
      message: 'Purchase created successfully',
      data: result,
      meta: undefined,
    });
  });
});
