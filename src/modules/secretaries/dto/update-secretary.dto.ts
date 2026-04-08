import { IsString, IsEmail, IsOptional } from 'class-validator';
import { IsPhoneAR_VE }                  from '../../../common/validators/phone.validator';

export class UpdateSecretaryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail({}, { message: 'El email no es válido' })
  @IsOptional()
  email?: string;

  @IsPhoneAR_VE()
  @IsOptional()
  phone?: string;
}
