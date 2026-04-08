/**
 * secretaries.service.spec.ts
 * Tests para la validación de email único cruzado entre secretarias y profesionales,
 * y para la validación del número de teléfono en la capa de DTO (phone.validator).
 */
import { ConflictException } from '@nestjs/common';
import { SecretariesService } from './secretaries.service';

function makeSecretaryRepo(overrides: Partial<any> = {}): any {
  return {
    findOne:  jest.fn().mockResolvedValue(null),
    find:     jest.fn(),
    update:   jest.fn().mockResolvedValue(undefined),
    save:     jest.fn().mockImplementation((e) => Promise.resolve({ id: 1, ...e })),
    create:   jest.fn().mockImplementation((e) => e),
    ...overrides,
  };
}

function makeProfessionalRepo(overrides: Partial<any> = {}): any {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find:    jest.fn(),
    ...overrides,
  };
}

function makeService(secOverrides: Partial<any> = {}, profOverrides: Partial<any> = {}): SecretariesService {
  return new (SecretariesService as any)(makeSecretaryRepo(secOverrides), makeProfessionalRepo(profOverrides));
}

const baseDto    = { name: 'Ana López', email: 'ana@test.com', organizationId: 1 };
const existingSec = { id: 10, name: 'Ana López', email: 'ana@test.com', isActive: true };

describe('SecretariesService.create()', () => {
  it('crea la secretaria cuando el email no está en uso', async () => {
    const svc = makeService();
    const result = await svc.create(baseDto);
    expect(result).toHaveProperty('secretary');
    expect(result).toHaveProperty('resetToken');
  });

  it('lanza ConflictException si el email ya pertenece a otra secretaria', async () => {
    const svc = makeService({
      findOne: jest.fn().mockResolvedValue({ id: 2, email: 'ana@test.com' }),
    });
    await expect(svc.create(baseDto)).rejects.toThrow(ConflictException);
  });

  it('lanza ConflictException si el email ya pertenece a un profesional', async () => {
    const svc = makeService(
      {},
      { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'ana@test.com' }) },
    );
    await expect(svc.create(baseDto)).rejects.toThrow(ConflictException);
  });
});

describe('SecretariesService.update()', () => {
  it('actualiza nombre y teléfono sin conflicto', async () => {
    const svc = makeService({
      // solo se llama una vez: findOne(id)
      findOne: jest.fn().mockResolvedValue({ ...existingSec }),
      save:    jest.fn().mockImplementation((e) => Promise.resolve(e)),
    });
    const result = await svc.update(10, { name: 'Ana M. López', phone: '+5491112345678' });
    expect(result.secretary.name).toBe('Ana M. López');
    expect(result.emailChanged).toBe(false);
  });

  it('detecta emailChanged=true cuando el email es diferente', async () => {
    const svc = makeService({
      findOne: jest.fn()
        .mockResolvedValueOnce({ ...existingSec })  // findOne(id)
        .mockResolvedValueOnce(null),               // comprobación email — no hay otra sec
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    });
    const result = await svc.update(10, { email: 'nuevo@test.com' });
    expect(result.emailChanged).toBe(true);
  });

  it('lanza ConflictException si el nuevo email ya pertenece a otra secretaria', async () => {
    const svc = makeService({
      findOne: jest.fn()
        .mockResolvedValueOnce({ ...existingSec })               // findOne(id)
        .mockResolvedValueOnce({ id: 99, email: 'nuevo@test.com' }), // conflicto sec
      save: jest.fn(),
    });
    await expect(svc.update(10, { email: 'nuevo@test.com' })).rejects.toThrow(ConflictException);
  });

  it('lanza ConflictException si el nuevo email ya pertenece a un profesional', async () => {
    const svc = makeService(
      {
        findOne: jest.fn()
          .mockResolvedValueOnce({ ...existingSec }) // findOne(id)
          .mockResolvedValueOnce(null),              // sin conflicto entre secretarias
        save: jest.fn(),
      },
      { findOne: jest.fn().mockResolvedValue({ id: 5, email: 'nuevo@test.com' }) },
    );
    await expect(svc.update(10, { email: 'nuevo@test.com' })).rejects.toThrow(ConflictException);
  });
});
