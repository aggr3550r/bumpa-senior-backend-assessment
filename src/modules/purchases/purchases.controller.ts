import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ResponseModel } from '../../models/response.model';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('users/:userId/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  async createCompletedPurchase(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: CreatePurchaseDto,
  ) {
    const purchase = await this.purchasesService.createCompletedPurchase(
      userId,
      body.amount,
    );

    return ResponseModel.success(
      'Purchase created successfully',
      purchase,
      undefined,
      HttpStatus.CREATED,
    );
  }
}
