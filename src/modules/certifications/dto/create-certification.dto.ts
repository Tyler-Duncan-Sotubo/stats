import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  IsInt,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateCertificationDto {
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
  territory!: string;

  @IsString()
  body!: string;

  @IsString()
  title!: string;

  @IsIn(['diamond', 'platinum', 'gold', 'silver'])
  level!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  units?: number;

  @IsOptional()
  @IsDateString()
  certifiedAt?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  rawArtistName?: string;

  @IsOptional()
  @IsString()
  rawTitle?: string;

  @IsOptional()
  @IsIn(['matched', 'artist_only', 'unresolved'])
  resolutionStatus?: string;
}
