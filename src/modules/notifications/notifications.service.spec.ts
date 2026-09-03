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

describe('NotificationsService.logNotification() — nunca debe tirar abajo la acción que la llamó', () => {
  const originalFetch = global.fetch;
  const originalBrevoKey = process.env.BREVO_API_KEY;
  const service: any = { name: 'Consulta', durationMinutes: 30 };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BREVO_API_KEY = originalBrevoKey;
    jest.restoreAllMocks();
  });

  it('bug real de producción (2026-09-02): si notifications_log.save() falla (ej. columna faltante), reservar un turno no debe devolver 500', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' }) as any;

    const logRepo = {
      create: jest.fn((e) => e),
      save:   jest.fn().mockRejectedValue(new Error("Unknown column 'status' in field list")),
    };
    const svc = new (NotificationsService as any)(logRepo);

    // Antes del fix: logNotification() no atrapaba su propio error, y como el catch()
    // de sendAppointmentConfirmation vuelve a llamar logNotification() en su rama de
    // error, el segundo throw escapaba sin control — la promesa de este await rechazaba.
    await expect(
      svc.sendAppointmentConfirmation(appointment, client, professional, service),
    ).resolves.toBeUndefined();
  });

  it('tampoco rompe cuando la falla ocurre en la rama catch (sendEmail también falló)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout')) as any;
    const logRepo = {
      create: jest.fn((e) => e),
      save:   jest.fn().mockRejectedValue(new Error("Unknown column 'status' in field list")),
    };
    const svc = new (NotificationsService as any)(logRepo);

    await expect(
      svc.sendAppointmentConfirmation(appointment, client, professional, service),
    ).resolves.toBeUndefined();
  });
});

describe('NotificationsService — confirmación y recordatorio, mismo gap que completed', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
    jest.restoreAllMocks();
  });

  const apptWithToken: any = { ...appointment, token: 'tok', status: 'confirmed' };

  it('sendAppointmentConfirmation registra failed en vez de sent cuando el envío falla', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Brevo caído' }) as any;

    const { svc, logRepo } = makeService();
    await svc.sendAppointmentConfirmation(apptWithToken, client, professional, { name: 'Consulta' });

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 42, event: 'confirmation', status: 'failed' }),
    );
  });

  it('resendConfirmationToClient registra failed en vez de sent cuando el envío falla', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Brevo caído' }) as any;

    const { svc, logRepo } = makeService();
    await svc.resendConfirmationToClient(apptWithToken, client, professional, { name: 'Consulta' });

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 42, event: 'reminder', status: 'failed' }),
    );
  });
});

describe('NotificationsService — emails de bienvenida devuelven si salieron o no', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
    jest.restoreAllMocks();
  });

  it('sendWelcomeProfessional devuelve false si Brevo falla', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'error' }) as any;
    const { svc } = makeService();

    const result = await svc.sendWelcomeProfessional({
      toEmail: 'dr@test.com', professionalName: 'Dr. X', email: 'dr@test.com', resetToken: 'x', slug: 'dr-x',
    });

    expect(result).toBe(false);
  });

  it('sendWelcomeSecretary devuelve true si el envío sale bien', async () => {
    process.env.BREVO_API_KEY = 'fake-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' }) as any;
    const { svc } = makeService();

    const result = await svc.sendWelcomeSecretary({ toEmail: 'ana@test.com', name: 'Ana', token: 'x' });

    expect(result).toBe(true);
  });
});
