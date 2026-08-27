import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService, toInitials } from './reviews.service';

function makeRepo(overrides: Partial<any> = {}) {
  return {
    create:        jest.fn((e) => e),
    save:          jest.fn().mockImplementation((e) => Promise.resolve({ id: 1, ...e })),
    findOne:       jest.fn(),
    findOneOrFail: jest.fn(),
    find:          jest.fn(),
    update:        jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<any> = {}) {
  const repo = makeRepo(repoOverrides);
  const svc  = new (ReviewsService as any)(repo);
  return { svc, repo };
}

describe('toInitials', () => {
  it('convierte nombre y apellido a iniciales', () => {
    expect(toInitials('María González')).toBe('M. G.');
  });

  it('cubre nombres compuestos de 3+ palabras', () => {
    expect(toInitials('Juan De La Cruz')).toBe('J. D. L. C.');
  });
});

describe('ReviewsService.createInviteForAppointment()', () => {
  it('toma el nombre del cliente de la cita, no lo pide después', async () => {
    const { svc, repo } = makeService();
    const appointment: any = { id: 5, professionalId: 10 };
    const client: any = { name: 'Juan Pérez' };

    await svc.createInviteForAppointment(appointment, client);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      professionalId: 10, appointmentId: 5, reviewerName: 'Juan Pérez', status: 'invitado',
    }));
  });
});

describe('ReviewsService.getInviteForPublic()', () => {
  it('lanza NotFoundException si el token no existe', async () => {
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(svc.getInviteForPublic('nope')).rejects.toThrow(NotFoundException);
  });

  it('lanza ForbiddenException si la invitación ya fue usada', async () => {
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue({ id: 1, status: 'pendiente' }) });
    await expect(svc.getInviteForPublic('used-token')).rejects.toThrow(ForbiddenException);
  });

  it('devuelve la invitación si sigue en estado invitado', async () => {
    const invite = { id: 1, status: 'invitado', reviewerName: 'Juan Pérez' };
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue(invite) });
    await expect(svc.getInviteForPublic('token')).resolves.toEqual(invite);
  });
});

describe('ReviewsService.submit()', () => {
  it('pasa la invitación a pendiente con rating y comentario', async () => {
    const invite = { id: 1, status: 'invitado' };
    const { svc, repo } = makeService({
      findOne: jest.fn().mockResolvedValue(invite),
      findOneOrFail: jest.fn().mockResolvedValue({ ...invite, status: 'pendiente' }),
    });

    await svc.submit('token', { rating: 5, comment: '  Excelente atención  ' });

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      rating: 5, comment: 'Excelente atención', status: 'pendiente',
    }));
  });

  it('rechaza enviar sobre un token ya usado', async () => {
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue({ id: 1, status: 'publicada' }) });
    await expect(svc.submit('token', { rating: 5, comment: 'x' })).rejects.toThrow(ForbiddenException);
  });
});

describe('ReviewsService.approve() / reject()', () => {
  it('aprueba una reseña pendiente', async () => {
    const { svc, repo } = makeService({
      findOne: jest.fn().mockResolvedValue({ id: 1, professionalId: 10, status: 'pendiente' }),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 1, status: 'publicada' }),
    });
    const result = await svc.approve(10, 1);
    expect(repo.update).toHaveBeenCalledWith(1, { status: 'publicada' });
    expect(result.status).toBe('publicada');
  });

  it('lanza NotFoundException si la reseña no pertenece a ese profesional', async () => {
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(svc.approve(10, 1)).rejects.toThrow(NotFoundException);
  });

  it('rechaza moderar una invitación que todavía no fue contestada', async () => {
    const { svc } = makeService({ findOne: jest.fn().mockResolvedValue({ id: 1, professionalId: 10, status: 'invitado' }) });
    await expect(svc.approve(10, 1)).rejects.toThrow(BadRequestException);
  });

  it('permite ir y volver entre publicada y rechazada (sin máquina de estados estricta)', async () => {
    const { svc, repo } = makeService({
      findOne: jest.fn().mockResolvedValue({ id: 1, professionalId: 10, status: 'publicada' }),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 1, status: 'rechazada' }),
    });
    const result = await svc.reject(10, 1);
    expect(result.status).toBe('rechazada');
  });
});

describe('ReviewsService.getPublicPublished()', () => {
  const publishedReviews = [
    { id: 1, reviewerName: 'María González', rating: 5, comment: 'Genial', submittedAt: new Date('2026-08-20') },
  ];

  it('redacta a iniciales para el vertical health', async () => {
    const { svc } = makeService({ find: jest.fn().mockResolvedValue(publishedReviews) });
    const result = await svc.getPublicPublished(10, 'health');
    expect(result[0].reviewerName).toBe('M. G.');
  });

  it('muestra el nombre completo para beauty/wellness/other', async () => {
    const { svc } = makeService({ find: jest.fn().mockResolvedValue(publishedReviews) });
    const result = await svc.getPublicPublished(10, 'beauty');
    expect(result[0].reviewerName).toBe('María González');
  });

  it('solo pide las reseñas con status=publicada', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const { svc } = makeService({ find });
    await svc.getPublicPublished(10, 'health');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      where: { professionalId: 10, status: 'publicada' },
    }));
  });
});
