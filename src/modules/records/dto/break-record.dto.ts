import { IsDateString, IsOptional, IsString } from 'class-validator';

export class BreakRecordDto {
  @IsDateString()
  brokenOn!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
