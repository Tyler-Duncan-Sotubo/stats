import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateArtistDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  spotifyId?: string;

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  debutYear?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;

  @IsOptional()
  @IsBoolean()
  isAfrobeatsOverride?: boolean;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsIn(['canonical', 'provisional', 'merged', 'rejected'])
  entityStatus?: string;

  @IsOptional()
  @IsString()
  sourceOfTruth?: string;
}
