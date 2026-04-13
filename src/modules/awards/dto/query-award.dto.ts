import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAwardDto {
  @IsUUID()
  @IsOptional()
  artistId?: string;

  @IsUUID()
  @IsOptional()
  songId?: string;

  @IsUUID()
  @IsOptional()
  albumId?: string;

  @IsString()
  @IsOptional()
  awardBody?: string; // filter by 'Grammy', 'BET' etc

  @IsEnum(['won', 'nominated'])
  @IsOptional()
  result?: 'won' | 'nominated';

  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  territory?: string;
}
