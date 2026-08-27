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

  it('rechaza slogan/address de más de 255 caracteres', async () => {
    const long = 'a'.repeat(256);
    const errors = await validate(buildValid({ slogan: long, address: long }));
    expect(errors.find((e) => e.property === 'slogan')).toBeDefined();
    expect(errors.find((e) => e.property === 'address')).toBeDefined();
  });

  it('rechaza bio de más de 2000 caracteres', async () => {
    const errors = await validate(buildValid({ bio: 'a'.repeat(2001) }));
    expect(errors.find((e) => e.property === 'bio')).toBeDefined();
  });

  it('acepta slogan/bio/address dentro del límite', async () => {
    const errors = await validate(buildValid({ slogan: 'a'.repeat(255), bio: 'a'.repeat(2000), address: 'a'.repeat(255) }));
    expect(errors.find((e) => ['slogan', 'bio', 'address'].includes(e.property))).toBeUndefined();
  });

  it('rechaza password inicial de menos de 10 caracteres', async () => {
    const errors = await validate(buildValid({ password: 'corta123' })); // 8 chars
    expect(errors.find((e) => e.property === 'password')).toBeDefined();
  });

  it('acepta password inicial de 10 caracteres o más', async () => {
    const errors = await validate(buildValid({ password: 'diezcaracteres' }));
    expect(errors.find((e) => e.property === 'password')).toBeUndefined();
  });
});
