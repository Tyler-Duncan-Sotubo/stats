import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsInt,
  IsIn,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateAlbumDto {
  @IsUUID()
  artistId!: string;

  @IsString()
  title!: string;

  @IsString()
  spotifyAlbumId!: string;

  @IsOptional()
  @IsIn(['album', 'single', 'compilation', 'ep'])
  albumType?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalTracks?: number;

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;
}
