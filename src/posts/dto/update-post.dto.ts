import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  MaxLength,
  MinLength,
  IsPositive,
  ArrayUnique,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Content must be at least 10 characters long' })
  @MaxLength(20000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @IsPositive()
  authorId?: number;

  @ArrayUnique()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one category is required' })
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ each: true })
  categoryIds?: number[];
}
