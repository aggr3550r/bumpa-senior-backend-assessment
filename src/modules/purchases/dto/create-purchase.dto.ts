import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({
    example: 1200,
    minimum: 1,
    description: 'Completed purchase amount in the application minor unit.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}
