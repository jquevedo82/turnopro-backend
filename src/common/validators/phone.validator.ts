/**
 * phone.validator.ts
 * Validador personalizado para teléfonos de Argentina y Venezuela.
 *
 * Formato esperado (desde PhoneInput del frontend):
 *   código de país + número local, puede incluir espacios o guiones.
 *   Ej: "+54 9 11 1234-5678"  →  normaliza a "+5491112345678"
 *
 * Reglas por país (contando solo dígitos del número local):
 *   Argentina (+54): 10 dígitos (fijo) u 11 dígitos (móvil con 9 de prefijo)
 *   Venezuela (+58): exactamente 10 dígitos
 */
import { registerDecorator, ValidationOptions } from 'class-validator';

export const PHONE_MESSAGE =
  'Teléfono inválido. Argentina +54: 10-11 dígitos. Venezuela +58: 10 dígitos.';

/** Elimina espacios, guiones y paréntesis y valida el formato */
export function validatePhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/[\s\-\(\)]/g, '');
  return /^\+(54\d{10,11}|58\d{10})$/.test(normalized);
}

/** Decorador @IsPhoneAR_VE() para usar en DTOs */
export function IsPhoneAR_VE(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneAR_VE',
      target: object.constructor,
      propertyName,
      options: { message: PHONE_MESSAGE, ...validationOptions },
      validator: { validate: validatePhone },
    });
  };
}
