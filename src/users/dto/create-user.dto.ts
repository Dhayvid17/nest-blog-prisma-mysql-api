import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: 'Email format is invalid',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128)
  @Matches(/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W)/, {
    message:
      'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;
}
