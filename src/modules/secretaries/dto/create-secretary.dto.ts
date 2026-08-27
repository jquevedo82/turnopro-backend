import { IsString, IsEmail, IsOptional } from 'class-validator';
import { IsSupportedPhone }                  from '../../../common/validators/phone.validator';

export class CreateSecretaryDto {
  @IsString()
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @IsSupportedPhone()
  @IsOptional()
  phone?: string;
}
