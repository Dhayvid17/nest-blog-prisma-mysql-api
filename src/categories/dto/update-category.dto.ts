import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
