import { IsUUID } from 'class-validator';

export class CreateSongFeatureDto {
  @IsUUID()
  featuredArtistId!: string;
}
