import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsEnum(['admin', 'editor', 'contributor'])
  @IsOptional()
  role?: 'admin' | 'editor' | 'contributor';

  @IsString()
  @IsOptional()
  location?: string;
}
