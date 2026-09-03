/**
 * appointments.pending.spec.ts
 * Reportado por el usuario (2026-09-03): sin auto-confirmación, una cita pendiente
 * de un día futuro no aparecía en ningún lado del panel — la única forma de verla
 * era navegar el calendario día por día. Este endpoint trae TODAS las PENDING sin
 * importar la fecha, ordenadas por la más próxima primero.
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';

function makeService(repoOverrides: Partial<any> = {}) {
  const repo = { find: jest.fn(), ...repoOverrides };
  const svc = new (AppointmentsService as any)(repo, {}, {}, {}, {}, {});
  return { svc, repo };
}

describe('AppointmentsService.getPendingAppointments()', () => {
  it('trae solo las citas PENDING del profesional, ordenadas por fecha y hora ascendente', async () => {
    const { svc, repo } = makeService({ find: jest.fn().mockResolvedValue([]) });

    await svc.getPendingAppointments(10);

    expect(repo.find).toHaveBeenCalledWith({
      where: { professionalId: 10, status: AppointmentStatus.PENDING },
      relations: ['client', 'service'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
  });
});
