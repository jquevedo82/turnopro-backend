/**
 * notifications.service.spec.ts
 * Verifica el fix del 2026-08-26: antes, si Brevo/Nodemailer fallaba, sendEmail()
 * lo swallowaba internamente sin re-lanzar el error — el catch de cada método de
 * notificación nunca se disparaba por una falla real de envío, y notifications_log
 * quedaba registrando 'sent' aunque el email nunca hubiera salido. Ahora sendEmail()
 * devuelve { success, error } y cada método usa ese resultado para loguear el estado real.
 */
import { NotificationsService } from './notifications.service';

function makeService() {
  const logRepo = {
    create: jest.fn((e) => e),
    save:   jest.fn().mockResolvedValue(undefined),
  };
  const svc = new (NotificationsService as any)(logRepo);
  return { svc, logRepo };
}

const professional: any = {
  id: 1, name: 'Dra. García', email: 'garcia@test.com', publicEmail: null,
  slug: 'dra-garcia', professionalType: 'health',
};
const client: any = { name: 'Juan Pérez', email: 'juan@test.com', phone: '+5491112345678' };
const appointment: any = { id: 42, date: '2026-08-27', startTime: '10:00' };

describe('NotificationsService.notifyClientAppointmentCompleted() — registro real de éxito/fallo', () => {
  const originalFetch = global.fetch;
  const originalBrevoKey = process.env.BREVO_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BREVO_API_KEY = originalBrevoKey;
    jest.restoreAllMocks();
  });

  it('registra status=sent cuando Brevo responde OK', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' }) as any;

    const { svc, logRepo } = makeService();
    await svc.notifyClientAppointmentCompleted(appointment, client, professional);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 42, event: 'completed', status: 'sent' }),
    );
  });

  it('registra status=failed con el detalle del error cuando Brevo responde con error', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => 'Brevo: api-key inválida',
    }) as any;

    const { svc, logRepo } = makeService();
    await svc.notifyClientAppointmentCompleted(appointment, client, professional);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 42,
        event:         'completed',
        status:        'failed',
        error:         expect.stringContaining('Brevo: api-key inválida'),
      }),
    );
  });

  it('antes del fix esto habría quedado como sent — confirma que ya no ocurre', async () => {
    // Regresión concreta: sendEmail() ya no swallowa en silencio dejando el log mentiroso.
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout')) as any;

    const { svc, logRepo } = makeService();
    await svc.notifyClientAppointmentCompleted(appointment, client, professional);

    const call = logRepo.save.mock.calls[0][0];
    expect(call.status).toBe('failed');
    expect(call.status).not.toBe('sent');
  });
});
