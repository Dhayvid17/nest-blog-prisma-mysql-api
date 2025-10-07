import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  MaxLength,
  MinLength,
  IsPositive,
  ArrayUnique,
  isPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(20000)
  content: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @IsPositive()
  authorId: number;

  @ArrayUnique()
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ each: true })
  categoryIds?: number[];
}
