// src/modules/api-keys/dto/request-api-key.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  MinLength,
} from 'class-validator';

export class RequestApiKeyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  intendedUse?: string;
}
