import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ResponseModel } from '../../models/response.model';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@Controller('users/:userId/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a completed purchase for a user' })
  @ApiParam({
    name: 'userId',
    description: 'User ID that owns the purchase.',
    format: 'uuid',
  })
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
