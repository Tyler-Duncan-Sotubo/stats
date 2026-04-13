// src/modules/awards/inputs/create-award.input.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  IsUrl,
  Min,
  Max,
} from 'class-validator';

export class CreateAwardDto {
  @IsUUID()
  @IsNotEmpty()
  artistId!: string;

  @IsUUID()
  @IsOptional()
  songId?: string | null;

  @IsUUID()
  @IsOptional()
  albumId?: string | null;

  @IsString()
  @IsNotEmpty()
  awardBody!: string; // 'Grammy', 'BET', 'MTV VMA', 'MOBO'

  @IsString()
  @IsNotEmpty()
  awardName!: string; // 'Best Global Music Album'

  @IsString()
  @IsNotEmpty()
  category!: string; // 'Album', 'Song', 'Artist'

  @IsEnum(['won', 'nominated'])
  result!: 'won' | 'nominated';

  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsString()
  @IsOptional()
  ceremony?: string | null; // '66th Grammy Awards'

  @IsString()
  @IsOptional()
  territory?: string | null; // 'US' | 'UK' | 'GLOBAL'

  @IsUrl()
  @IsOptional()
  sourceUrl?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
