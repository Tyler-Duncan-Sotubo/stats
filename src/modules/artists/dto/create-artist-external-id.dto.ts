import { IsString, IsOptional, IsIn, IsUrl } from 'class-validator';

export class CreateArtistExternalIdDto {
  @IsIn(['spotify', 'kworb', 'musicbrainz', 'apple_music'])
  source!: string;

  @IsString()
  externalId!: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}
