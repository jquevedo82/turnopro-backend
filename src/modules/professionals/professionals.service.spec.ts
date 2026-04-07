/**
 * professionals.service.spec.ts
 * Tests para la validación de conflictos en update().
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';

function makeProf(overrides: Partial<any> = {}): any {
  return { id: 1, name: 'Dr. García', email: 'dr@test.com', slug: 'dr-garcia', password: 'hash', ...overrides };
}

function makeService(repoOverrides: Partial<any> = {}): ProfessionalsService {
  const repo = {
    findOne:  jest.fn(),
    update:   jest.fn().mockResolvedValue(undefined),
    save:     jest.fn(),
    create:   jest.fn(),
    find:     jest.fn(),
    createQueryBuilder: jest.fn(),
    ...repoOverrides,
  };
  return new (ProfessionalsService as any)(repo, {});
}

describe('ProfessionalsService.update()', () => {
  it('actualiza sin conflicto cuando el slug pertenece al mismo profesional', async () => {
    const prof = makeProf({ id: 4, slug: 'dr-garcia' });
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(prof)   // findOne(id) — existe
        .mockResolvedValueOnce(prof)   // conflicto — mismo id → no hay conflicto
        .mockResolvedValueOnce(prof),  // findOne(id) al final
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, {});

    await expect(svc.update(4, { slug: 'dr-garcia' })).resolves.not.toThrow();
  });

  it('lanza ConflictException si el slug ya lo usa otro profesional', async () => {
    const existing = makeProf({ id: 1, slug: 'slug-ocupado' }); // id diferente al que editamos
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(makeProf({ id: 4 })) // findOne(id=4) — existe
        .mockResolvedValueOnce(existing),            // conflicto → otro prof tiene ese slug
      update: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, {});

    await expect(svc.update(4, { slug: 'slug-ocupado' })).rejects.toThrow(ConflictException);
  });

  it('lanza ConflictException si el email ya lo usa otro profesional', async () => {
    const existing = makeProf({ id: 2, email: 'otro@test.com' });
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(makeProf({ id: 4 }))
        .mockResolvedValueOnce(existing),
      update: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, {});

    await expect(svc.update(4, { email: 'otro@test.com' })).rejects.toThrow(ConflictException);
  });

  it('no verifica conflicto si no se envía slug ni email', async () => {
    const prof = makeProf({ id: 4 });
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(prof)  // findOne(id) — existe
        .mockResolvedValueOnce(prof), // findOne(id) al final
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, {});

    await expect(svc.update(4, { name: 'Nuevo Nombre' })).resolves.toBeDefined();
    // findOne solo se llama 2 veces: verificar existencia + retornar resultado
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('lanza NotFoundException si el profesional no existe', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, {});

    await expect(svc.update(99, { name: 'Test' })).rejects.toThrow(NotFoundException);
  });
});
