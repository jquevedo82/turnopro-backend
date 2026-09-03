/**
 * appointments.notify-async.spec.ts
 * Reportado por el usuario (2026-09-03): reconfirmar una cita desde el link
 * público (/cita/:token) tardaba muchísimo en mostrar "cita confirmada" — la
 * misma causa que ya se había corregido en create() ese mismo día, pero en
 * otras 4 acciones que quedaron sin tocar: confirm(), cancel(), reconfirm() y
 * complete() esperaban (await) a que el email saliera por Brevo (una o hasta
 * dos llamadas HTTP externas seguidas) antes de responder, con el estado ya
 * cambiado en la base desde antes. Estas pruebas verifican que cada acción
 * resuelve sin esperar a que la promesa de notificación se resuelva.
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus }   from './appointment-status.enum';

const client = { id: 1, name: 'Juan Pérez', email: 'juan@test.com', phone: '+5491112345678' };
const professional = { id: 10, name: 'Dra. García', slug: 'dra-garcia', cancellationHours: 0 };

function pendingPromise() {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe('AppointmentsService — notificaciones no bloquean la respuesta', () => {
  it('confirm() responde sin esperar el email al cliente', async () => {
    const { promise: emailPending, release } = pendingPromise();
    const appt = { id: 5, professionalId: 10, status: AppointmentStatus.PENDING, client, service: {} };
    const repo = { findOne: jest.fn().mockResolvedValue(appt), update: jest.fn().mockResolvedValue(undefined) };
    const professionalsService = { findOne: jest.fn().mockResolvedValue(professional) };
    const notificationsService = { notifyClientAppointmentConfirmed: jest.fn().mockReturnValue(emailPending) };
    const svc = new (AppointmentsService as any)(repo, {}, professionalsService, {}, {}, notificationsService, {});

    const result = await svc.confirm(5, 10);

    expect(result).toMatchObject({ id: 5 });
    release();
  });

  it('cancel() responde sin esperar el email al cliente', async () => {
    const { promise: emailPending, release } = pendingPromise();
    const appt = { id: 5, professionalId: 10, status: AppointmentStatus.CONFIRMED, client, service: {}, professional };
    const repo = { findOne: jest.fn().mockResolvedValue(appt), update: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = { notifyClientCancellation: jest.fn().mockReturnValue(emailPending) };
    const svc = new (AppointmentsService as any)(repo, {}, {}, {}, {}, notificationsService, {});

    const result = await svc.cancel(5, 'professional', 10);

    expect(result).toMatchObject({ id: 5 });
    release();
  });

  it('reconfirm() responde sin esperar el email de aviso al profesional (el bug reportado: /cita/:token tardaba mucho)', async () => {
    const { promise: emailPending, release } = pendingPromise();
    const appt = { id: 5, token: 'tok123', status: AppointmentStatus.CONFIRMED, client, service: {}, professional };
    const repo = { findOne: jest.fn().mockResolvedValue(appt), update: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = { notifyProfessionalClientReconfirmed: jest.fn().mockReturnValue(emailPending) };
    const svc = new (AppointmentsService as any)(repo, {}, {}, {}, {}, notificationsService, {});

    const result = await svc.reconfirm('tok123', 'client');

    expect(result).toMatchObject({ id: 5 });
    release();
  });

  it('complete() responde sin esperar el email de agradecimiento al cliente', async () => {
    const { promise: emailPending, release } = pendingPromise();
    const appt = { id: 5, professionalId: 10, status: AppointmentStatus.CONFIRMED, client };
    const repo = { findOne: jest.fn().mockResolvedValue(appt), update: jest.fn().mockResolvedValue(undefined) };
    const professionalsService = { bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined), findOne: jest.fn().mockResolvedValue(professional) };
    const notificationsService = { notifyClientAppointmentCompleted: jest.fn().mockReturnValue(emailPending) };
    const reviewsService = { createInviteForAppointment: jest.fn().mockResolvedValue({ id: 1, token: 'tok' }) };
    const svc = new (AppointmentsService as any)(repo, {}, professionalsService, {}, {}, notificationsService, reviewsService);

    const result = await svc.complete(5, 10);

    expect(result).toMatchObject({ id: 5 });
    release();
  });
});
