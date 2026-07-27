import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProfessionalDto } from './create-professional.dto';

function buildValid(overrides = {}): CreateProfessionalDto {
  return plainToInstance(CreateProfessionalDto, {
    name: 'Dr. García',
    email: 'garcia@test.com',
    profession: 'Médico',
    slug: 'dr-garcia',
    ...overrides,
  });
}

describe('CreateProfessionalDto — validaciones', () => {
  it('acepta un DTO válido sin errores', async () => {
    const errors = await validate(buildValid());
    expect(errors).toHaveLength(0);
  });

  it('rechaza phone inválido (antes de 2026-07-20 no validaba nada)', async () => {
    const errors = await validate(buildValid({ phone: 'no-es-un-telefono' }));
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('acepta phone de los 3 países soportados', async () => {
    for (const phone of ['+5491112345678', '+573001234567', '+584121234567']) {
      const errors = await validate(buildValid({ phone }));
      expect(errors.find((e) => e.property === 'phone')).toBeUndefined();
    }
  });

  it('acepta country con un código soportado', async () => {
    const errors = await validate(buildValid({ country: '+57' }));
    expect(errors.find((e) => e.property === 'country')).toBeUndefined();
  });

  it('rechaza country con un código no soportado', async () => {
    const errors = await validate(buildValid({ country: '+55' })); // Brasil
    expect(errors.find((e) => e.property === 'country')).toBeDefined();
  });
});
