/**
 * availability.arrived.spec.ts
 * Regresión: antes del fix, un paciente marcado ARRIVED o IN_PROGRESS dejaba de
 * bloquear su propio horario en el cálculo de disponibilidad — el query de citas
 * ocupadas solo incluía PENDING/CONFIRMED/RECONFIRMED/COMPLETED. Un paciente en
 * sala de espera o en consulta podía terminar con otro paciente reservado encima
 * de su mismo horario.
 */
import { AvailabilityService } from './availability.service';
import { AppointmentStatus }   from '../appointments/appointment-status.enum';

function makeQueryBuilder(existing: any[]) {
  const qb: any = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.where             = jest.fn().mockReturnValue(qb);
  qb.andWhere          = jest.fn().mockReturnValue(qb);
  qb.select            = jest.fn().mockReturnValue(qb);
  qb.getMany           = jest.fn().mockResolvedValue(existing);
  return qb;
}

function makeService(occupied: any[] = []) {
  const qb = makeQueryBuilder(occupied);
  const appointmentRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const scheduleService = {
    getExceptionForDate: jest.fn().mockResolvedValue(null),
    getWeeklySchedule:   jest.fn().mockResolvedValue([
      { dayOfWeek: new Date('2026-08-31T12:00:00').getDay(), isActive: true, startTime: '09:00', endTime: '18:00' },
    ]),
  };
  const professionalsService = {
    findOne: jest.fn().mockResolvedValue({
      id: 1, phone: '+5491112345678',
      minAdvanceHours: 0, maxAdvanceDays: 60,
      slotDurationMinutes: 30, bufferMinutes: 0,
    }),
  };
  const servicesService = { findOne: jest.fn().mockResolvedValue({ durationMinutes: 30, bufferMinutes: 0 }) };
  const svc = new (AvailabilityService as any)(appointmentRepo, scheduleService, professionalsService, servicesService);
  return { svc, appointmentRepo, qb };
}

describe('AvailabilityService.getAvailableSlots() — estados que bloquean', () => {
  // Fecha de "hoy" fijada para que la fecha consultada (2026-08-31) no quede en el
  // pasado con el correr del tiempo real y corte antes de llegar al query (bug que
  // este mismo test tuvo al escribirse el 2026-08-29 y quedar en el pasado el 2026-09-02).
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('incluye ARRIVED e IN_PROGRESS en el filtro de citas ocupadas', async () => {
    const { svc, qb } = makeService([]);

    await svc.getAvailableSlots(1, '2026-08-31');

    const statusCall = qb.andWhere.mock.calls.find(([sql]: [string]) => sql.includes('a.status IN'));
    expect(statusCall[1].statuses).toEqual(
      expect.arrayContaining([AppointmentStatus.ARRIVED, AppointmentStatus.IN_PROGRESS]),
    );
  });

  it('un paciente marcado ARRIVED sigue bloqueando su propio horario', async () => {
    const { svc } = makeService([
      { startTime: '10:00:00', endTime: '10:30:00', service: { bufferMinutes: 0 } },
    ]);

    const slots = await svc.getAvailableSlots(1, '2026-08-31', undefined);

    expect(slots).not.toContain('10:00');
  });
});
