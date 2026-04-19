import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsDateString,
} from 'class-validator';

export class CreateRecordDto {
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @IsOptional()
  @IsUUID()
  songId?: string;

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsString()
  recordType!: string;

  @IsString()
  recordValue!: string;

  @IsOptional()
  @IsInt()
  numericValue?: number;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  setOn?: string;

  @IsOptional()
  @IsDateString()
  brokenOn?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
