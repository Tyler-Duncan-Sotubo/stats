import { PartialType } from '@nestjs/mapped-types';
import { CreateArtistDto } from './create-artist.dto';
import { IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class UpdateArtistDto extends PartialType(CreateArtistDto) {
  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @IsUUID()
  mergedIntoArtistId?: string;
}
