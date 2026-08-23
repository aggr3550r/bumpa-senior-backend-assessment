import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BankAccountDetailsDto {
  @ApiProperty({
    example: '0123456789',
    description: 'Customer bank account number.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'accountNumber must contain only digits' })
  accountNumber: string;

  @ApiProperty({
    example: '044',
    description: 'Payment-provider bank code for the customer bank.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({
    example: 'Ada Customer',
    description:
      'Submitted account name. Verification replaces the stored value.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  accountName: string;

  @ApiProperty({
    example: 'NGN',
    description: 'ISO 4217 currency code for the payout account.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsISO4217CurrencyCode()
  currency: string;
}

export class CreateUserDto {
  @ApiProperty({
    example: 'ada@example.com',
    description: 'Unique user email address.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'Ada',
    nullable: true,
    description: 'User profile first name.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string | null;

  @ApiPropertyOptional({
    example: 'Customer',
    nullable: true,
    description: 'User profile last name.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @ApiProperty({
    type: BankAccountDetailsDto,
    description: 'Required bank details used to verify and prepare payouts.',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => BankAccountDetailsDto)
  bankAccountDetails: BankAccountDetailsDto;
}
