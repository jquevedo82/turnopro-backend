import { IsString, IsEmail, IsOptional } from 'class-validator';
import { IsSupportedPhone }                  from '../../../common/validators/phone.validator';

export class UpdateSecretaryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail({}, { message: 'El email no es válido' })
  @IsOptional()
  email?: string;

  @IsSupportedPhone()
  @IsOptional()
  phone?: string;
}
