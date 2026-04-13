// src/modules/awards/inputs/update-award.input.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  IsUrl,
  Min,
  Max,
} from 'class-validator';

export class UpdateAwardDto {
  @IsUUID()
  @IsOptional()
  songId?: string | null;

  @IsUUID()
  @IsOptional()
  albumId?: string | null;

  @IsString()
  @IsOptional()
  awardBody?: string;

  @IsString()
  @IsOptional()
  awardName?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(['won', 'nominated'])
  @IsOptional()
  result?: 'won' | 'nominated';

  @IsInt()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  ceremony?: string | null;

  @IsString()
  @IsOptional()
  territory?: string | null;

  @IsUrl()
  @IsOptional()
  sourceUrl?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
