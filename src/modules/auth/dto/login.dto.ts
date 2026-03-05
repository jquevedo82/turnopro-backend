import { IsEmail, IsString, MinLength } from 'class-validator';
export class LoginDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;
  @IsString()
  @MinLength(6)
  password: string;
}
