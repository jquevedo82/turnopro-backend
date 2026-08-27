/**
 * update-professional.dto.spec.ts
 * Prueba específicamente el bug corregido 2026-07-20: PATCH /professionals/:id
 * usaba `Partial<CreateProfessionalDto>` (un tipo de TS, no una clase), así que el
 * ValidationPipe de Nest no validaba nada. UpdateProfessionalDto es una clase real
 * (PartialType(CreateProfessionalDto)) — estos tests demuestran que SÍ valida.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfessionalDto } from './update-professional.dto';

describe('UpdateProfessionalDto — validaciones (fix del bypass de Partial<>)', () => {
  it('acepta un body parcial vacío (todos los campos son opcionales)', async () => {
    const errors = await validate(plainToInstance(UpdateProfessionalDto, {}));
    expect(errors).toHaveLength(0);
  });

  it('rechaza email inválido', async () => {
    const dto = plainToInstance(UpdateProfessionalDto, { email: 'no-es-un-email' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'email')).toBeDefined();
  });

  it('rechaza phone inválido', async () => {
    const dto = plainToInstance(UpdateProfessionalDto, { phone: 'ABC123' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('rechaza slug con mayúsculas o espacios', async () => {
    const dto = plainToInstance(UpdateProfessionalDto, { slug: 'Dr García' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'slug')).toBeDefined();
  });

  it('rechaza country no soportado', async () => {
    const dto = plainToInstance(UpdateProfessionalDto, { country: '+1' }); // USA, no soportado
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'country')).toBeDefined();
  });

  it('acepta un update parcial válido con email, phone y country', async () => {
    const dto = plainToInstance(UpdateProfessionalDto, {
      email: 'nuevo@test.com', phone: '+584121234567', country: '+58',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
