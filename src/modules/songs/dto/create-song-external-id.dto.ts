import { IsString, IsOptional, IsIn, IsUrl } from 'class-validator';

export class CreateSongExternalIdDto {
  @IsIn(['spotify', 'isrc', 'kworb', 'apple_music'])
  source!: string;

  @IsString()
  externalId!: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}
