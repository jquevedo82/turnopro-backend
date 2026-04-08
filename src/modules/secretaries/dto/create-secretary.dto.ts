import { IsString, IsEmail, IsOptional } from 'class-validator';
import { IsPhoneAR_VE }                  from '../../../common/validators/phone.validator';

export class CreateSecretaryDto {
  @IsString()
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @IsPhoneAR_VE()
  @IsOptional()
  phone?: string;
}
