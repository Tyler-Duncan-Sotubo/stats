// dto/reset-password.dto.ts
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  token!: string;
}
