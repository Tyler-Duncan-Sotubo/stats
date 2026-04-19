import {
  IsArray,
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';

export class BulkUpdateArtistsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;
}
