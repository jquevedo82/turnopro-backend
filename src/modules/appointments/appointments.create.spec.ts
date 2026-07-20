/**
 * appointments.create.spec.ts
 * Tests unitarios del fix de race condition en create(): lock nombrado por
 * (profesional, fecha) + re-chequeo de choque de horario dentro de la transacción.
 */
import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';

function makeQueryBuilder(existing: { startTime: string; endTime: string }[]) {
  const qb: any = {};
  qb.where    = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.select   = jest.fn().mockReturnValue(qb);
  qb.getMany  = jest.fn().mockResolvedValue(existing);
  return qb;
}

function makeManager(existing: { startTime: string; endTime: string }[], lockAcquired = true) {
  return {
    query: jest.fn().mockResolvedValue([{ lock: lockAcquired ? 1 : 0 }]),
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(existing)),
    create: jest.fn((_entity, data) => data),
    save:   jest.fn((_entity, data) => Promise.resolve({ id: 99, ...data })),
  };
}

function makeService(manager: ReturnType<typeof makeManager>) {
  const repo = { manager: { transaction: jest.fn((cb: any) => cb(manager)) } };
  const clientsService = { findOrCreate: jest.fn().mockResolvedValue({ id: 5 }) };
  const professionalsService = { findOne: jest.fn().mockResolvedValue({ id: 10, autoConfirm: false }) };
  const servicesService = { findOne: jest.fn().mockResolvedValue({ id: 1, durationMinutes: 30 }) };
  const availabilityService = { getAvailableSlots: jest.fn().mockResolvedValue(['09:00', '09:30', '10:00']) };
  const notificationsService = {
    sendAppointmentConfirmation:       jest.fn().mockResolvedValue(undefined),
    notifyProfessionalNewAppointment:  jest.fn().mockResolvedValue(undefined),
  };
  const svc = new (AppointmentsService as any)(
    repo, clientsService, professionalsService, servicesService, availabilityService, notificationsService,
  );
  return { svc, repo, clientsService, professionalsService, servicesService, availabilityService, notificationsService };
}

const baseDto = {
  professionalId: 10, serviceId: 1, date: '2026-08-01', startTime: '09:00',
  clientName: 'Juan García', clientEmail: 'juan@test.com', clientPhone: '+5491112345678',
};

describe('AppointmentsService.create() — race condition', () => {
  it('crea la cita cuando no hay choque real dentro de la transacción', async () => {
    const manager = makeManager([]); // sin citas existentes ese día
    const { svc } = makeService(manager);

    const result = await svc.create(baseDto as any);

    expect(result).toMatchObject({ professionalId: 10, startTime: '09:00', status: AppointmentStatus.PENDING });
    expect(manager.query).toHaveBeenNthCalledWith(1, expect.stringContaining('GET_LOCK'), ['turnopro:appt:10:2026-08-01']);
    expect(manager.query).toHaveBeenNthCalledWith(2, expect.stringContaining('RELEASE_LOCK'), ['turnopro:appt:10:2026-08-01']);
    expect(manager.save).toHaveBeenCalled();
  });

  it('rechaza si availabilityService ya no incluye el horario (chequeo rápido)', async () => {
    const manager = makeManager([]);
    const { svc, availabilityService } = makeService(manager);
    availabilityService.getAvailableSlots.mockResolvedValue(['10:00']); // 09:00 ya no está

    await expect(svc.create(baseDto as any)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rechaza dentro de la transacción si otra reserva concurrente ya ocupó el horario (la race condition en sí)', async () => {
    // Simula el escenario real: availabilityService dijo que 09:00 estaba libre (se calculó
    // antes de que la otra request commiteara), pero al re-chequear dentro del lock ya hay
    // una cita PENDING que choca con [09:00, 09:30).
    const manager = makeManager([{ startTime: '09:00:00', endTime: '09:30:00' }]);
    const { svc } = makeService(manager);

    await expect(svc.create(baseDto as any)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
    // el lock se libera igual aunque falle el re-chequeo
    expect(manager.query).toHaveBeenNthCalledWith(2, expect.stringContaining('RELEASE_LOCK'), ['turnopro:appt:10:2026-08-01']);
  });

  it('no rechaza por una cita existente que NO se superpone con el horario pedido', async () => {
    const manager = makeManager([{ startTime: '10:00:00', endTime: '10:30:00' }]);
    const { svc } = makeService(manager);

    await expect(svc.create(baseDto as any)).resolves.toBeDefined();
    expect(manager.save).toHaveBeenCalled();
  });

  it('rechaza con mensaje de reintento si no logra adquirir el lock (GET_LOCK timeout)', async () => {
    const manager = makeManager([], /* lockAcquired */ false);
    const { svc } = makeService(manager);

    await expect(svc.create(baseDto as any)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
    // no se intenta liberar un lock que nunca se adquirió
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
