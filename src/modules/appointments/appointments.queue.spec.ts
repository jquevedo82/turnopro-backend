/**
 * appointments.queue.spec.ts
 * Tests unitarios para la funcionalidad de sala de espera:
 *   markArrived(), startConsultation(), getQueue(), getPublicQueue(), getQueueVersion()
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService }  from './appointments.service';
import { AppointmentStatus }    from './appointment-status.enum';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAppt(overrides: Partial<any> = {}): any {
  return {
    id:             1,
    professionalId: 10,
    date:           '2026-04-05',
    startTime:      '09:00',
    status:         AppointmentStatus.CONFIRMED,
    arrivedAt:      null,
    client:         { id: 1, name: 'Juan García' },
    service:        { id: 1, name: 'Consulta' },
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<any> = {}, profSvcOverrides: Partial<any> = {}): AppointmentsService {
  const repo = {
    findOne:       jest.fn(),
    find:          jest.fn(),
    update:        jest.fn().mockResolvedValue(undefined),
    save:          jest.fn(),
    create:        jest.fn(),
    createQueryBuilder: jest.fn(),
    ...repoOverrides,
  };

  const profSvc = {
    findOne:            jest.fn(),
    findBySlug:         jest.fn(),
    bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined),
    ...profSvcOverrides,
  };

  return new (AppointmentsService as any)(
    repo,
    {},      // clientsService
    profSvc, // professionalsService
    {},      // servicesService
    {},      // availabilityService
    {},      // notificationsService
  );
}

// ── markArrived ───────────────────────────────────────────────────────────────

describe('AppointmentsService.markArrived()', () => {
  it('marca ARRIVED desde CONFIRMED y bumps queueUpdatedAt', async () => {
    const appt = makeAppt({ status: AppointmentStatus.CONFIRMED });
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(appt)   // findOneByProfessional
        .mockResolvedValueOnce(appt),  // findById al final
      find:   jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save:   jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const profSvc = {
      findOne:            jest.fn(),
      findBySlug:         jest.fn(),
      bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await svc.markArrived(1, 10);

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      status:    AppointmentStatus.ARRIVED,
      arrivedAt: expect.any(Date),
    }));
    expect(profSvc.bumpQueueUpdatedAt).toHaveBeenCalledWith(10);
  });

  it('marca ARRIVED desde RECONFIRMED', async () => {
    const appt = makeAppt({ status: AppointmentStatus.RECONFIRMED });
    const repo = {
      findOne: jest.fn().mockResolvedValue(appt),
      find: jest.fn(), update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined) };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await svc.markArrived(1, 10);

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: AppointmentStatus.ARRIVED }));
  });

  it('rechaza si la cita no es CONFIRMED ni RECONFIRMED', async () => {
    const appt = makeAppt({ status: AppointmentStatus.PENDING });
    const repo = {
      findOne: jest.fn().mockResolvedValue(appt),
      find: jest.fn(), update: jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn() };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await expect(svc.markArrived(1, 10)).rejects.toThrow(BadRequestException);
  });

  it('rechaza si la cita no pertenece al profesional', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(), update: jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn() };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await expect(svc.markArrived(99, 10)).rejects.toThrow(NotFoundException);
  });
});

// ── startConsultation ─────────────────────────────────────────────────────────

describe('AppointmentsService.startConsultation()', () => {
  it('cambia a IN_PROGRESS desde ARRIVED y bumps queueUpdatedAt', async () => {
    const appt = makeAppt({ status: AppointmentStatus.ARRIVED });
    const repo = {
      findOne: jest.fn().mockResolvedValue(appt),
      find: jest.fn(), update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined) };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await svc.startConsultation(1, 10);

    expect(repo.update).toHaveBeenCalledWith(1, { status: AppointmentStatus.IN_PROGRESS });
    expect(profSvc.bumpQueueUpdatedAt).toHaveBeenCalledWith(10);
  });

  it('rechaza si la cita no está en ARRIVED', async () => {
    const appt = makeAppt({ status: AppointmentStatus.CONFIRMED });
    const repo = {
      findOne: jest.fn().mockResolvedValue(appt),
      find: jest.fn(), update: jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn() };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    await expect(svc.startConsultation(1, 10)).rejects.toThrow(BadRequestException);
  });
});

// ── getQueue ──────────────────────────────────────────────────────────────────

describe('AppointmentsService.getQueue()', () => {
  it('devuelve citas del día en los estados activos ordenadas por arrivedAt luego startTime', async () => {
    const appts = [
      makeAppt({ id: 1, startTime: '09:00', status: AppointmentStatus.ARRIVED,     arrivedAt: new Date('2026-04-05T09:05:00') }),
      makeAppt({ id: 2, startTime: '10:00', status: AppointmentStatus.IN_PROGRESS, arrivedAt: new Date('2026-04-05T09:50:00') }),
      makeAppt({ id: 3, startTime: '11:00', status: AppointmentStatus.CONFIRMED,   arrivedAt: null }),
    ];
    const repo = {
      findOne: jest.fn(),
      find:    jest.fn().mockResolvedValue(appts),
      update:  jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = { findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn() };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    const result = await svc.getQueue(10, '2026-04-05');
    expect(result).toHaveLength(3);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      order: { arrivedAt: 'ASC', startTime: 'ASC' },
    }));
  });
});

// ── getPublicQueue ────────────────────────────────────────────────────────────

describe('AppointmentsService.getPublicQueue()', () => {
  it('anonimiza el nombre correctamente y asigna posición', async () => {
    const appts = [
      makeAppt({ id: 1, status: AppointmentStatus.ARRIVED,    arrivedAt: new Date(), client: { name: 'Juan García' } }),
      makeAppt({ id: 2, status: AppointmentStatus.IN_PROGRESS, arrivedAt: new Date(), client: { name: 'Ana López' } }),
    ];
    const repo = {
      findOne: jest.fn(),
      find:    jest.fn().mockResolvedValue(appts),
      update:  jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = {
      findOne:            jest.fn(),
      findBySlug:         jest.fn().mockResolvedValue({ id: 10, queueUpdatedAt: new Date() }),
      bumpQueueUpdatedAt: jest.fn(),
    };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    const result = await svc.getPublicQueue('dr-garcia', '2026-04-05');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: 1, name: 'Juan G.', status: AppointmentStatus.ARRIVED });
    expect(result[1]).toMatchObject({ position: 2, name: 'Ana L.', status: AppointmentStatus.IN_PROGRESS });
  });

  it('maneja paciente con nombre de una sola palabra', async () => {
    const appts = [
      makeAppt({ id: 1, status: AppointmentStatus.ARRIVED, arrivedAt: new Date(), client: { name: 'Paco' } }),
    ];
    const repo = {
      findOne: jest.fn(),
      find:    jest.fn().mockResolvedValue(appts),
      update:  jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = {
      findOne:            jest.fn(),
      findBySlug:         jest.fn().mockResolvedValue({ id: 10, queueUpdatedAt: null }),
      bumpQueueUpdatedAt: jest.fn(),
    };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    const result = await svc.getPublicQueue('dr-garcia', '2026-04-05');
    expect(result[0].name).toBe('Paco');
  });
});

// ── getQueueVersion ───────────────────────────────────────────────────────────

describe('AppointmentsService.getQueueVersion()', () => {
  it('devuelve queueUpdatedAt del profesional', async () => {
    const ts = new Date('2026-04-05T10:00:00');
    const repo = {
      findOne: jest.fn(), find: jest.fn(), update: jest.fn(),
      save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = {
      findOne:            jest.fn(),
      findBySlug:         jest.fn().mockResolvedValue({ id: 10, queueUpdatedAt: ts }),
      bumpQueueUpdatedAt: jest.fn(),
    };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    const result = await svc.getQueueVersion('dr-garcia');
    expect(result).toEqual({ queueUpdatedAt: ts });
  });

  it('devuelve null si nunca hubo acciones en la cola', async () => {
    const repo = {
      findOne: jest.fn(), find: jest.fn(), update: jest.fn(),
      save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    };
    const profSvc = {
      findOne:            jest.fn(),
      findBySlug:         jest.fn().mockResolvedValue({ id: 10, queueUpdatedAt: null }),
      bumpQueueUpdatedAt: jest.fn(),
    };
    const svc = new (AppointmentsService as any)(repo, {}, profSvc, {}, {}, {});

    const result = await svc.getQueueVersion('dr-garcia');
    expect(result).toEqual({ queueUpdatedAt: null });
  });
});
