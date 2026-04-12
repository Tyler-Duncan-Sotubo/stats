// src/modules/certifications/dto/create-certification.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  IsPositive,
  IsISO31661Alpha2,
  IsDateString,
  IsUrl,
  IsIn,
} from 'class-validator';
import { CreateCertificationInput } from '../inputs/create-certification.input';

export class CreateCertificationDto implements CreateCertificationInput {
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @IsOptional()
  @IsUUID()
  songId?: string;

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsISO31661Alpha2()
  territory!: string;

  @IsString()
  @IsNotEmpty()
  body!: string; // 'RIAA' | 'BPI' | 'IFPI' etc.

  @IsIn(['silver', 'gold', 'platinum', 'diamond'])
  level!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  units?: number; // 3 = 3x Platinum

  @IsOptional()
  @IsDateString()
  certifiedAt?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}
