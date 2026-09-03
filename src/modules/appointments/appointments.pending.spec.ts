/**
 * appointments.pending.spec.ts
 * getUpcomingAppointments() — citas de cualquier fecha desde hoy en adelante.
 * Generalizado más allá de solo PENDING a pedido del usuario (2026-09-03):
 * "no sería bueno saber cuáles están confirmadas... para no tener que
 * recorrer todos los días" — con status filtra a ese estado puntual, sin
 * status trae todo lo que sigue abierto (pending/confirmed/reconfirmed).
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';
import { MoreThanOrEqual, In } from 'typeorm';

function makeService(repoOverrides: Partial<any> = {}, profSvcOverrides: Partial<any> = {}) {
  const repo = { find: jest.fn(), ...repoOverrides };
  const professionalsService = {
    findOne: jest.fn().mockResolvedValue({ id: 10, phone: '+5491112345678' }),
    ...profSvcOverrides,
  };
  const svc = new (AppointmentsService as any)(repo, {}, professionalsService, {}, {}, {});
  return { svc, repo, professionalsService };
}

describe('AppointmentsService.getUpcomingAppointments()', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T15:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('sin status: trae pending, confirmed y reconfirmed desde hoy (huso local del profesional)', async () => {
    const { svc, repo } = makeService({ find: jest.fn().mockResolvedValue([]) });

    await svc.getUpcomingAppointments(10);

    expect(repo.find).toHaveBeenCalledWith({
      where: {
        professionalId: 10,
        date: MoreThanOrEqual('2026-09-03'),
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.RECONFIRMED]),
      },
      relations: ['client', 'service'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
  });

  it('con status: filtra solo a ese estado puntual (ej. confirmadas)', async () => {
    const { svc, repo } = makeService({ find: jest.fn().mockResolvedValue([]) });

    await svc.getUpcomingAppointments(10, AppointmentStatus.CONFIRMED);

    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: In([AppointmentStatus.CONFIRMED]) }),
    }));
  });

  it('resuelve el corte de "hoy" a partir del teléfono del profesional consultado (no de uno fijo)', async () => {
    const professionalsService = { findOne: jest.fn().mockResolvedValue({ id: 11, phone: '+584121234567' }) };
    const { svc } = makeService({ find: jest.fn().mockResolvedValue([]) }, professionalsService);

    await svc.getUpcomingAppointments(11);

    expect(professionalsService.findOne).toHaveBeenCalledWith(11);
  });
});
