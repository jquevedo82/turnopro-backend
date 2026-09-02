/**
 * appointments.stats.spec.ts
 * Estadísticas mensuales del profesional (citas atendidas, cancelaciones, tasa de
 * no-show, servicio más solicitado) — calculadas sobre el mes-calendario LOCAL del
 * profesional, mismo criterio de huso horario que getTomorrowAppointments().
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';
import { Between } from 'typeorm';

function makeService(repoOverrides: Partial<any> = {}, profSvcOverrides: Partial<any> = {}) {
  const repo = {
    findOne: jest.fn(), find: jest.fn(), update: jest.fn(), count: jest.fn(),
    save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    ...repoOverrides,
  };
  const professionalsService = {
    findOne: jest.fn(),
    ...profSvcOverrides,
  };
  const svc = new (AppointmentsService as any)(repo, {}, professionalsService, {}, {}, {});
  return { svc, repo, professionalsService };
}

describe('AppointmentsService.getMonthlyStats()', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('consulta el rango del mes en curso en el huso local del profesional', async () => {
    const { svc, repo, professionalsService } = makeService({ find: jest.fn().mockResolvedValue([]) });
    professionalsService.findOne.mockResolvedValue({ id: 10, phone: '+5491112345678' });

    await svc.getMonthlyStats(10);

    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        professionalId: 10,
        date: Between('2026-08-01', '2026-08-31'),
      }),
    }));
  });

  it('cuenta completadas, canceladas y no-shows, y calcula la tasa de no-show', async () => {
    const appts = [
      { status: AppointmentStatus.COMPLETED, service: { name: 'Consulta' } },
      { status: AppointmentStatus.COMPLETED, service: { name: 'Consulta' } },
      { status: AppointmentStatus.NO_SHOW,   service: { name: 'Consulta' } },
      { status: AppointmentStatus.CANCELLED, service: { name: 'Control' } },
      { status: AppointmentStatus.PENDING,   service: { name: 'Control' } },
    ];
    const { svc, professionalsService } = makeService({ find: jest.fn().mockResolvedValue(appts) });
    professionalsService.findOne.mockResolvedValue({ id: 10, phone: '+5491112345678' });

    const stats = await svc.getMonthlyStats(10);

    expect(stats.completed).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.noShow).toBe(1);
    expect(stats.noShowRate).toBe(33); // 1 / (2 completed + 1 no_show) redondeado
    expect(stats.topService).toEqual({ name: 'Consulta', count: 3 });
    expect(stats.month).toBe('2026-08');
  });

  it('devuelve topService null y noShowRate 0 si no hay citas en el mes', async () => {
    const { svc, professionalsService } = makeService({ find: jest.fn().mockResolvedValue([]) });
    professionalsService.findOne.mockResolvedValue({ id: 10, phone: '+5491112345678' });

    const stats = await svc.getMonthlyStats(10);

    expect(stats.topService).toBeNull();
    expect(stats.noShowRate).toBe(0);
  });

  it('usa el huso de Venezuela (+58) para el corte de mes de ese profesional', async () => {
    const { svc, repo, professionalsService } = makeService({ find: jest.fn().mockResolvedValue([]) });
    professionalsService.findOne.mockResolvedValue({ id: 11, phone: '+584121234567' });

    await svc.getMonthlyStats(11);

    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ date: Between('2026-08-01', '2026-08-31') }),
    }));
  });
});

describe('AppointmentsService.getGlobalCompletedCount()', () => {
  it('cuenta las citas completadas en todo el sistema, sin filtrar por profesional', async () => {
    const { svc, repo } = makeService({ count: jest.fn().mockResolvedValue(42) });

    const result = await svc.getGlobalCompletedCount();

    expect(repo.count).toHaveBeenCalledWith({ where: { status: AppointmentStatus.COMPLETED } });
    expect(result).toEqual({ totalCompleted: 42 });
  });
});
