import { IsUUID } from 'class-validator';

export class MergeSongDto {
  @IsUUID()
  targetSongId!: string;
}
