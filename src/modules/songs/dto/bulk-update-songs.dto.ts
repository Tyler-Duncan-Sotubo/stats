import {
  IsArray,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsIn,
  ArrayMinSize,
} from 'class-validator';

export class BulkUpdateSongsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsOptional()
  @IsBoolean()
  isAfrobeats?: boolean;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @IsIn(['canonical', 'provisional', 'merged', 'rejected'])
  entityStatus?: string;
}
