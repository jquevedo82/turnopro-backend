/**
 * professionals.service.spec.ts
 * Tests para la validación de conflictos en update().
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { localDateString, addDays } from '../../common/utils/timezone';

function makeProf(overrides: Partial<any> = {}): any {
  return { id: 1, name: 'Dr. García', email: 'dr@test.com', slug: 'dr-garcia', password: 'hash', ...overrides };
}

function makeSecretaryRepo(overrides: Partial<any> = {}): any {
  return {
    findOne: jest.fn().mockResolvedValue(null), // por defecto no hay secretaria con ese email
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<any> = {}, secretaryRepoOverrides: Partial<any> = {}): ProfessionalsService {
  const repo = {
    findOne:  jest.fn(),
    update:   jest.fn().mockResolvedValue(undefined),
    save:     jest.fn(),
    create:   jest.fn(),
    find:     jest.fn(),
    createQueryBuilder: jest.fn(),
    ...repoOverrides,
  };
  return new (ProfessionalsService as any)(repo, makeSecretaryRepo(secretaryRepoOverrides), {});
}

describe('ProfessionalsService.create()', () => {
  it('lanza ConflictException si el email ya pertenece a una secretaria', async () => {
    const repo = {
      findOne:  jest.fn().mockResolvedValue(null), // no hay profesional con ese email
      save:     jest.fn(),
      create:   jest.fn().mockReturnValue({}),
      find:     jest.fn(),
      update:   jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const secretaryRepo = makeSecretaryRepo({
      findOne: jest.fn().mockResolvedValue({ id: 5, email: 'shared@test.com' }), // secretaria existente
    });
    const svc = new (ProfessionalsService as any)(repo, secretaryRepo, {});

    await expect(
      svc.create({ name: 'Dr. X', email: 'shared@test.com', slug: 'dr-x', profession: 'Médico' })
    ).rejects.toThrow(ConflictException);
  });

  it('informa emailSent=false si el email de bienvenida falla, sin romper la creación', async () => {
    const saved = { id: 1, email: 'dr@test.com', name: 'Dr. X', slug: 'dr-x' };
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save:    jest.fn().mockResolvedValue(saved),
      create:  jest.fn((e) => e),
      update:  jest.fn().mockResolvedValue(undefined),
    };
    const notifications = { sendWelcomeProfessional: jest.fn().mockResolvedValue(false) };
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), notifications);

    const result = await svc.create({ name: 'Dr. X', email: 'dr@test.com', slug: 'dr-x', profession: 'Médico' });

    expect(notifications.sendWelcomeProfessional).toHaveBeenCalled();
    expect((result as any).emailSent).toBe(false);
  });

  it('informa emailSent=true si el email de bienvenida sale bien', async () => {
    const saved = { id: 1, email: 'dr@test.com', name: 'Dr. X', slug: 'dr-x' };
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save:    jest.fn().mockResolvedValue(saved),
      create:  jest.fn((e) => e),
      update:  jest.fn().mockResolvedValue(undefined),
    };
    const notifications = { sendWelcomeProfessional: jest.fn().mockResolvedValue(true) };
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), notifications);

    const result = await svc.create({ name: 'Dr. X', email: 'dr@test.com', slug: 'dr-x', profession: 'Médico' });

    expect((result as any).emailSent).toBe(true);
  });
});

describe('ProfessionalsService.resendWelcome()', () => {
  it('devuelve emailSent=false y un mensaje claro si el envío falla', async () => {
    const professional = { id: 1, email: 'dr@test.com', name: 'Dr. X', slug: 'dr-x' };
    const repo = {
      findOne: jest.fn().mockResolvedValue(professional),
      update:  jest.fn().mockResolvedValue(undefined),
    };
    const notifications = { sendWelcomeProfessional: jest.fn().mockResolvedValue(false) };
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), notifications);

    const result = await svc.resendWelcome(1);

    expect(result.emailSent).toBe(false);
    expect(result.message).toContain('No se pudo enviar');
  });
});

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
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), {});

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
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), {});

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
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), {});

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
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), {});

    await expect(svc.update(4, { name: 'Nuevo Nombre' })).resolves.toBeDefined();
    // findOne solo se llama 2 veces: verificar existencia + retornar resultado
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('lanza ConflictException si el nuevo email ya pertenece a una secretaria', async () => {
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(makeProf({ id: 4 })) // findOne(id) — existe
        .mockResolvedValueOnce(null),               // sin conflicto entre profesionales
      update: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const secretaryRepo = makeSecretaryRepo({
      findOne: jest.fn().mockResolvedValue({ id: 7, email: 'sec@test.com' }), // secretaria con ese email
    });
    const svc = new (ProfessionalsService as any)(repo, secretaryRepo, {});

    await expect(svc.update(4, { email: 'sec@test.com' })).rejects.toThrow(ConflictException);
  });

  it('lanza NotFoundException si el profesional no existe', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const svc = new (ProfessionalsService as any)(repo, makeSecretaryRepo(), {});

    await expect(svc.update(99, { name: 'Test' })).rejects.toThrow(NotFoundException);
  });
});

describe('ProfessionalsService.isSubscriptionExpired()', () => {
  const svc = makeService();

  it('false si subscriptionEnd es null (profesional sin plan asignado nunca)', () => {
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: null }))).toBe(false);
  });

  it('false el mismo día del vencimiento (todavía es válido todo ese día local)', () => {
    const today = localDateString(-3); // "hoy" en Argentina
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: today, phone: '+5491112345678' }))).toBe(false);
  });

  it('false dentro de los 3 días de gracia', () => {
    const threeDaysAgo = addDays(localDateString(-3), -3);
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: threeDaysAgo, phone: '+5491112345678' }))).toBe(false);
  });

  it('true una vez pasados los 3 días de gracia', () => {
    const fourDaysAgo = addDays(localDateString(-3), -4);
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: fourDaysAgo, phone: '+5491112345678' }))).toBe(true);
  });

  it('usa el huso de Venezuela (-4) para un profesional con +58', () => {
    // vencido hace 4 días en huso Venezuela → true
    const fourDaysAgoVE = addDays(localDateString(-4), -4);
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: fourDaysAgoVE, phone: '+584121234567' }))).toBe(true);
  });

  it('acepta subscriptionEnd como Date (columna type: date de TypeORM) además de string', () => {
    const fourDaysAgo = addDays(localDateString(-3), -4);
    const asDate = new Date(fourDaysAgo + 'T00:00:00.000Z');
    expect(svc.isSubscriptionExpired(makeProf({ subscriptionEnd: asDate, phone: '+5491112345678' }))).toBe(true);
  });
});
