// src/modules/api-keys/dto/create-api-key.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsIn,
  MinLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsIn(['free', 'pro', 'enterprise'])
  tier?: 'free' | 'pro' | 'enterprise';
}
