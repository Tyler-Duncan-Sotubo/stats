import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateSongDto {
  @IsUUID()
  artistId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsOptional()
  @IsString()
  spotifyTrackId?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsBoolean()
  explicit?: boolean;

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(['canonical', 'provisional', 'merged', 'rejected'])
  entityStatus?: string;

  @IsOptional()
  @IsString()
  sourceOfTruth?: string;
}
