/**
 * appointments.timezone.spec.ts
 * Tests del fix de huso horario en getTomorrowAppointments() y sendAutomaticReminders():
 * "mañana" se calcula en la fecha-calendario local del profesional (por prefijo de
 * teléfono +54/+58), no en la del servidor (Render corre en UTC).
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';
import { localDateString, addDays } from '../../common/utils/timezone';

function makeService(repoOverrides: Partial<any> = {}, profSvcOverrides: Partial<any> = {}) {
  const repo = {
    findOne: jest.fn(), find: jest.fn(), update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
    ...repoOverrides,
  };
  const professionalsService = {
    findOne: jest.fn(), findBySlug: jest.fn(), bumpQueueUpdatedAt: jest.fn(),
    isSubscriptionExpired: jest.fn().mockReturnValue(false),
    ...profSvcOverrides,
  };
  const notificationsService = { sendAutomaticReminder: jest.fn().mockResolvedValue(undefined) };
  const svc = new (AppointmentsService as any)(repo, {}, professionalsService, {}, {}, notificationsService);
  return { svc, repo, professionalsService, notificationsService };
}

describe('AppointmentsService.getTomorrowAppointments()', () => {
  it('usa la fecha de mañana en el huso del profesional (Argentina), no la del servidor', async () => {
    const { svc, repo, professionalsService } = makeService();
    professionalsService.findOne.mockResolvedValue({ id: 10, phone: '+5491112345678' });
    repo.find.mockResolvedValue([]);

    await svc.getTomorrowAppointments(10);

    const expectedTomorrow = addDays(localDateString(-3), 1);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.arrayContaining([
        expect.objectContaining({ date: expectedTomorrow, status: AppointmentStatus.CONFIRMED }),
      ]),
    }));
  });

  it('usa el huso de Venezuela para un profesional con +58', async () => {
    const { svc, repo, professionalsService } = makeService();
    professionalsService.findOne.mockResolvedValue({ id: 11, phone: '+584121234567' });
    repo.find.mockResolvedValue([]);

    await svc.getTomorrowAppointments(11);

    const expectedTomorrow = addDays(localDateString(-4), 1);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.arrayContaining([
        expect.objectContaining({ date: expectedTomorrow }),
      ]),
    }));
  });
});

describe('AppointmentsService.sendAutomaticReminders()', () => {
  it('envía el recordatorio solo si la fecha de la cita coincide con "mañana" en el huso del propio profesional', async () => {
    const tomorrowAR = addDays(localDateString(-3), 1);
    const apptAR: any = {
      id: 1, date: tomorrowAR, status: AppointmentStatus.CONFIRMED, reminderSent: false,
      client: { id: 1 }, service: { id: 1 }, professional: { id: 10, phone: '+5491112345678' },
    };
    const { svc, repo, notificationsService } = makeService({ find: jest.fn().mockResolvedValue([apptAR]) });

    await svc.sendAutomaticReminders();

    expect(notificationsService.sendAutomaticReminder).toHaveBeenCalledWith(
      apptAR, apptAR.client, apptAR.professional, apptAR.service,
    );
    expect(repo.update).toHaveBeenCalledWith(1, { reminderSent: true });
  });

  it('NO envía si la fecha coincide con "mañana" en el huso ajeno pero no en el propio del profesional', async () => {
    // Cita fechada como "mañana en Venezuela" pero el profesional es argentino —
    // no es realmente "mañana" para él todavía (o ya pasó), no debe enviarse.
    const tomorrowVE = addDays(localDateString(-4), 1);
    const todayAR    = localDateString(-3);
    const apptAmbiguous: any = {
      id: 2, date: tomorrowVE, status: AppointmentStatus.CONFIRMED, reminderSent: false,
      client: { id: 2 }, service: { id: 2 }, professional: { id: 12, phone: '+5491112345678' },
    };
    const { svc, notificationsService } = makeService({ find: jest.fn().mockResolvedValue([apptAmbiguous]) });

    await svc.sendAutomaticReminders();

    if (tomorrowVE !== addDays(todayAR, 1)) {
      expect(notificationsService.sendAutomaticReminder).not.toHaveBeenCalled();
    }
  });

  it('no rompe el resto del batch si falla el envío de un recordatorio', async () => {
    const tomorrowAR = addDays(localDateString(-3), 1);
    const appt1: any = {
      id: 1, date: tomorrowAR, status: AppointmentStatus.CONFIRMED, reminderSent: false,
      client: {}, service: {}, professional: { id: 10, phone: '+5491112345678' },
    };
    const appt2: any = {
      id: 2, date: tomorrowAR, status: AppointmentStatus.CONFIRMED, reminderSent: false,
      client: {}, service: {}, professional: { id: 10, phone: '+5491112345678' },
    };
    const { svc, repo, notificationsService } = makeService({ find: jest.fn().mockResolvedValue([appt1, appt2]) });
    notificationsService.sendAutomaticReminder
      .mockRejectedValueOnce(new Error('Brevo caído'))
      .mockResolvedValueOnce(undefined);

    await svc.sendAutomaticReminders();

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(2, { reminderSent: true });
  });
});
