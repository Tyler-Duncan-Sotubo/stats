import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize, IsArray } from 'class-validator';
import { CreateAwardDto } from './create-award.dto';

export class BulkAwardDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAwardDto)
  awards!: CreateAwardDto[];
}
