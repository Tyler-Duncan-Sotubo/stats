import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsISO31661Alpha2,
  Length,
} from 'class-validator';

export class CreateArtistDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  spotifyId!: string;

  @IsOptional()
  @IsISO31661Alpha2()
  originCountry?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  debutYear?: number;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;

  @IsOptional()
  @IsBoolean()
  isAfrobeatsOverride?: boolean;
}
