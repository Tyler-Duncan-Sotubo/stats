import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateArtistGenreDto {
  @IsString()
  genre!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
