import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateSongAliasDto {
  @IsString()
  alias!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsIn(['billboard', 'official_charts', 'kworb', 'manual'])
  source?: string;
}
