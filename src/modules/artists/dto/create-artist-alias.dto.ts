import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateArtistAliasDto {
  @IsString()
  alias!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsIn(['billboard', 'official_charts', 'riaa', 'kworb', 'manual'])
  source?: string;
}
