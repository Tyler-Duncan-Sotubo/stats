import { IsUUID } from 'class-validator';

export class MergeArtistDto {
  @IsUUID()
  targetArtistId!: string;
}
