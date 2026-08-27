/**
 * create-organization.dto.spec.ts
 * Antes de 2026-07-20 este módulo no tenía carpeta dto/ — el body era un objeto
 * TypeScript inline que el ValidationPipe de Nest nunca validaba. Estos tests
 * demuestran que la clase nueva sí valida.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrganizationDto } from './create-organization.dto';
import { UpdateOrganizationDto } from './update-organization.dto';

describe('CreateOrganizationDto — validaciones', () => {
  it('acepta un DTO válido solo con name (único campo obligatorio)', async () => {
    const errors = await validate(plainToInstance(CreateOrganizationDto, { name: 'Clínica del Norte' }));
    expect(errors).toHaveLength(0);
  });

  it('rechaza sin name', async () => {
    const errors = await validate(plainToInstance(CreateOrganizationDto, {}));
    expect(errors.find((e) => e.property === 'name')).toBeDefined();
  });

  it('rechaza phone inválido', async () => {
    const dto = plainToInstance(CreateOrganizationDto, { name: 'Clínica', phone: 'no-es-telefono' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('acepta phone válido de los 3 países soportados', async () => {
    const dto = plainToInstance(CreateOrganizationDto, { name: 'Clínica', phone: '+573001234567' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'phone')).toBeUndefined();
  });

  it('rechaza email inválido', async () => {
    const dto = plainToInstance(CreateOrganizationDto, { name: 'Clínica', email: 'no-es-un-email' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'email')).toBeDefined();
  });

  it('rechaza slug con mayúsculas', async () => {
    const dto = plainToInstance(CreateOrganizationDto, { name: 'Clínica', slug: 'Clinica-Norte' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'slug')).toBeDefined();
  });
});

describe('UpdateOrganizationDto — validaciones', () => {
  it('acepta un body parcial vacío', async () => {
    const errors = await validate(plainToInstance(UpdateOrganizationDto, {}));
    expect(errors).toHaveLength(0);
  });

  it('rechaza phone inválido en un update parcial', async () => {
    const errors = await validate(plainToInstance(UpdateOrganizationDto, { phone: '123' }));
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('acepta isActive booleano', async () => {
    const errors = await validate(plainToInstance(UpdateOrganizationDto, { isActive: false }));
    expect(errors).toHaveLength(0);
  });

  it('rechaza isActive no booleano', async () => {
    const errors = await validate(plainToInstance(UpdateOrganizationDto, { isActive: 'sí' }));
    expect(errors.find((e) => e.property === 'isActive')).toBeDefined();
  });
});
