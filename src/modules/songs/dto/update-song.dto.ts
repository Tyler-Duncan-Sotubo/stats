import { PartialType } from '@nestjs/mapped-types';
import { CreateSongDto } from './create-song.dto';
import { IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class UpdateSongDto extends PartialType(CreateSongDto) {
  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @IsUUID()
  mergedIntoSongId?: string;
}
