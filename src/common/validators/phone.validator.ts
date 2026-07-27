/**
 * phone.validator.ts
 * Validador de teléfono para los países soportados por TurnoPro.
 *
 * Para agregar un país nuevo: agregarlo a SUPPORTED_PHONE_COUNTRIES — la validación
 * y el mensaje de error se arman solos a partir de esa lista, no hay que tocar el
 * regex a mano. El frontend tiene su propia lista equivalente en
 * turnopro-frontend/src/components/ui/PhoneInput.tsx (países distintos por app,
 * pero mismo principio: una sola lista fuente, nunca reglas duplicadas sueltas).
 *
 * Formato esperado (desde PhoneInput del frontend):
 *   código de país + número local, puede incluir espacios o guiones.
 *   Ej: "+54 9 11 1234-5678"  →  normaliza a "+5491112345678"
 */
import { registerDecorator, ValidationOptions } from 'class-validator';

export interface SupportedPhoneCountry {
  code:      string; // sin el '+', ej: '54'
  name:      string;
  minDigits: number;
  maxDigits: number;
}

export const SUPPORTED_PHONE_COUNTRIES: SupportedPhoneCountry[] = [
  { code: '54', name: 'Argentina', minDigits: 10, maxDigits: 11 },
  { code: '57', name: 'Colombia',  minDigits: 10, maxDigits: 10 },
  { code: '58', name: 'Venezuela', minDigits: 10, maxDigits: 10 },
];

export const PHONE_MESSAGE =
  'Teléfono inválido. ' +
  SUPPORTED_PHONE_COUNTRIES
    .map((c) => `${c.name} +${c.code}: ${c.minDigits === c.maxDigits ? c.minDigits : `${c.minDigits}-${c.maxDigits}`} dígitos.`)
    .join(' ');

/** Elimina espacios, guiones y paréntesis y valida el formato contra los países soportados */
export function validatePhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/[\s\-\(\)]/g, '');
  const match = normalized.match(/^\+(\d+)$/);
  if (!match) return false;
  const digitsOnly = match[1];

  return SUPPORTED_PHONE_COUNTRIES.some((country) => {
    if (!digitsOnly.startsWith(country.code)) return false;
    const localDigits = digitsOnly.slice(country.code.length).length;
    return localDigits >= country.minDigits && localDigits <= country.maxDigits;
  });
}

/** Decorador @IsSupportedPhone() para usar en DTOs — valida contra SUPPORTED_PHONE_COUNTRIES */
export function IsSupportedPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSupportedPhone',
      target: object.constructor,
      propertyName,
      options: { message: PHONE_MESSAGE, ...validationOptions },
      validator: { validate: validatePhone },
    });
  };
}
