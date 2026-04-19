import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsUrl,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateAwardDto {
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @IsOptional()
  @IsUUID()
  songId?: string;

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsString()
  awardBody!: string;

  @IsString()
  awardName!: string;

  @IsString()
  category!: string;

  @IsIn(['won', 'nominated'])
  result!: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  year!: number;

  @IsOptional()
  @IsString()
  ceremony?: string;

  @IsOptional()
  @IsString()
  territory?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
